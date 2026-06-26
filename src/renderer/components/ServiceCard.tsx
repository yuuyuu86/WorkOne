import { FiCheck, FiPlus } from 'react-icons/fi';
import type { ServiceTemplate } from '../types/service';
import { CATEGORY_LABELS } from '../types/service';
import { getIconColor } from '../data/iconMap';
import { ServiceIcon } from './ServiceIcon';

type Props = {
  template: ServiceTemplate;
  added: boolean;
  onAdd: () => void;
};

export function ServiceCard({ template, added, onAdd }: Props) {
  return (
    <div className="card service-card">
      <div className="service-card-head">
        <span
          className="service-card-icon"
          style={{ background: getIconColor(template.icon) ?? 'var(--text-secondary)' }}
        >
          <ServiceIcon iconKey={template.icon} size={20} />
        </span>
        <div>
          <div className="service-card-title">{template.name}</div>
          <div className="service-card-cat">
            {CATEGORY_LABELS[template.category]}
          </div>
        </div>
      </div>

      <div className="service-card-desc">{template.description}</div>

      <div className="support-badges">
        <span className="badge badge-on">Web表示</span>
        <span className="badge badge-soon">通知統合は今後対応</span>
      </div>

      <button
        className={`btn btn-block ${added ? '' : 'btn-primary'}`}
        onClick={onAdd}
        disabled={added}
      >
        {added ? (
          <>
            <FiCheck size={14} /> 追加済み
          </>
        ) : (
          <>
            <FiPlus size={14} /> 追加
          </>
        )}
      </button>
    </div>
  );
}
