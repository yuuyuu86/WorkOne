import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';
import { SERVICE_TEMPLATES } from '../data/serviceTemplates';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type ServiceCategory,
} from '../types/service';
import { ServiceCard } from './ServiceCard';
import { CustomServiceForm } from './CustomServiceForm';
import { SlackWorkspaceForm } from './SlackWorkspaceForm';

type Props = {
  onClose: () => void;
};

// テンプレートを扱うカテゴリ（custom は専用フォーム）
const TEMPLATE_CATEGORIES: ServiceCategory[] = CATEGORY_ORDER.filter(
  (c) => c !== 'custom'
);

export function AddServiceModal({ onClose }: Props) {
  const isTemplateAdded = useAppStore((s) => s.isTemplateAdded);
  const addServiceFromTemplate = useAppStore((s) => s.addServiceFromTemplate);
  // services を購読して追加済み表示を即時更新する
  useAppStore((s) => s.services);

  const [tab, setTab] = useState<ServiceCategory>('mail');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>サービスを追加</h3>
          <button className="icon-btn" onClick={onClose}>
            <FiX size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="segmented" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                className={tab === cat ? 'active' : ''}
                onClick={() => setTab(cat)}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {tab === 'custom' ? (
            <CustomServiceForm onAdded={onClose} />
          ) : (
            <div className="card-grid">
              {SERVICE_TEMPLATES.filter((t) => t.category === tab).map((t) => (
                <ServiceCard
                  key={t.templateKey}
                  template={t}
                  added={isTemplateAdded(t)}
                  onAdd={() => addServiceFromTemplate(t)}
                >
                  {t.templateKey === 'slack' && (
                    <SlackWorkspaceForm onAdded={onClose} />
                  )}
                </ServiceCard>
              ))}
            </div>
          )}

          {tab !== 'custom' &&
            !TEMPLATE_CATEGORIES.includes(tab) && (
              <p className="muted">このカテゴリのテンプレートはまだありません。</p>
            )}
        </div>
      </div>
    </div>
  );
}
