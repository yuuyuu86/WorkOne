// WorkOne のオンデバイス AI ヘルパー。
//
// Electron のメインプロセスから子プロセスとして起動され、標準入力から
// 1 行 1 JSON のリクエストを受け取り、1 行 1 JSON のレスポンスを返す。
// Apple Foundation Models（Mac 内蔵モデル）だけを使うため、通知の内容が
// Mac の外へ送信されることはない。
//
// リクエスト: {"id": "...", "cmd": "status" | "triage" | "digest", ...}
// レスポンス: {"id": "...", "ok": true, ...} / {"id": "...", "ok": false, "error": "..."}

import Foundation
import FoundationModels

// MARK: - 入出力の型

struct Request: Decodable {
    let id: String
    let cmd: String
    let items: [Item]?
    let today: String?

    struct Item: Decodable {
        let id: String?
        let service: String
        let title: String
        let body: String
    }
}

@Generable
struct TriageResult {
    @Guide(description: "入力と同じ順番の判定結果")
    var items: [TriageItem]
}

@Generable
struct TriageItem {
    @Guide(description: "入力の番号（0 始まり）")
    var index: Int
    @Guide(description: "今日中に対応が必要な度合い。0〜100 の整数", .range(0...100))
    var score: Int
    @Guide(description: "日本語で 40 文字以内の一行要約")
    var summary: String
    @Guide(description: "提出・返信・準備など具体的にやるべきことがあれば true")
    var hasTask: Bool
    @Guide(description: "やるべきことを動詞で終わる日本語 30 文字以内で。無ければ空文字")
    var taskTitle: String
    @Guide(description: "期限が読み取れれば YYYY-MM-DD、無ければ空文字")
    var taskDue: String
}

// MARK: - 出力

let stdout = FileHandle.standardOutput
let outLock = NSLock()

func send(_ obj: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: obj),
          var line = String(data: data, encoding: .utf8) else { return }
    line += "\n"
    outLock.lock()
    stdout.write(line.data(using: .utf8)!)
    outLock.unlock()
}

// MARK: - 可用性

func availability() -> (Bool, String?) {
    switch SystemLanguageModel.default.availability {
    case .available:
        return (true, nil)
    case .unavailable(let reason):
        switch reason {
        case .deviceNotEligible:
            return (false, "この Mac は Apple Intelligence に対応していません")
        case .appleIntelligenceNotEnabled:
            return (false, "システム設定で Apple Intelligence をオンにしてください")
        case .modelNotReady:
            return (false, "モデルを準備中です。しばらくしてから再度お試しください")
        @unknown default:
            return (false, "利用できません")
        }
    }
}

// MARK: - コマンド

let triageInstructions = """
あなたは学生・社会人向けの連絡アプリの受信箱アシスタントです。
各サービスから届いた通知を読み、今日対応が必要かを判定し、短く要約し、
やるべきこと（タスク）があれば抽出します。宣伝・自動送信・雑談は低いスコアにします。
締切・先生や上司からの依頼・自分宛てのメンションは高いスコアにします。
"""

func triage(_ req: Request) async throws -> [String: Any] {
    let items = req.items ?? []
    if items.isEmpty { return ["items": []] }
    var prompt = "今日は \(req.today ?? "") です。次の通知を判定してください。\n"
    for (i, it) in items.enumerated() {
        prompt += "\n[\(i)] サービス: \(it.service)\nタイトル: \(it.title)\n本文: \(it.body)\n"
    }
    let session = LanguageModelSession(instructions: triageInstructions)
    let res = try await session.respond(
        to: prompt,
        generating: TriageResult.self,
        options: GenerationOptions(temperature: 0.2)
    )
    var out: [[String: Any]] = []
    for r in res.content.items {
        guard r.index >= 0, r.index < items.count, let id = items[r.index].id else { continue }
        var row: [String: Any] = [
            "id": id,
            "score": max(0, min(100, r.score)),
            "summary": r.summary,
        ]
        let title = r.taskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        if r.hasTask && !title.isEmpty {
            var task: [String: Any] = ["title": title]
            if r.taskDue.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil {
                task["due"] = r.taskDue
            }
            row["task"] = task
        }
        out.append(row)
    }
    return ["items": out]
}

func digest(_ req: Request) async throws -> [String: Any] {
    let items = req.items ?? []
    if items.isEmpty { return ["text": "対応が必要な通知はありません。"] }
    var prompt = "次の通知（重要度の高い順）をもとに、今日まず対応すべきことを日本語で最大 3 行の箇条書き（「・」始まり）にまとめてください。前置きは不要です。通知に書かれていないことは書かないでください。\n"
    for it in items {
        prompt += "\n- [\(it.service)] \(it.title)：\(it.body)"
    }
    let session = LanguageModelSession(
        instructions: "あなたは簡潔に要点だけを伝える秘書です。"
    )
    let res = try await session.respond(to: prompt, options: GenerationOptions(temperature: 0.3))
    return ["text": res.content.trimmingCharacters(in: .whitespacesAndNewlines)]
}

// MARK: - メインループ

@main
struct WorkOneAI {
    static func main() async {
        let decoder = JSONDecoder()
        while let line = readLine(strippingNewline: true) {
            guard !line.isEmpty, let data = line.data(using: .utf8) else { continue }
            guard let req = try? decoder.decode(Request.self, from: data) else {
                send(["id": "", "ok": false, "error": "invalid request"])
                continue
            }
            let (available, reason) = availability()
            if req.cmd == "status" {
                var r: [String: Any] = ["id": req.id, "ok": true, "available": available]
                if let reason { r["reason"] = reason }
                send(r)
                continue
            }
            guard available else {
                send(["id": req.id, "ok": false, "error": reason ?? "unavailable"])
                continue
            }
            do {
                var result: [String: Any]
                switch req.cmd {
                case "triage": result = try await triage(req)
                case "digest": result = try await digest(req)
                default:
                    send(["id": req.id, "ok": false, "error": "unknown cmd"])
                    continue
                }
                result["id"] = req.id
                result["ok"] = true
                send(result)
            } catch {
                send(["id": req.id, "ok": false, "error": String(describing: error)])
            }
        }
    }
}
