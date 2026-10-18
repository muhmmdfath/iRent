import { type ReactNode } from 'react';
import {
  CheckCircledIcon,
  InfoCircledIcon,
  PlusIcon,
} from '@radix-ui/react-icons';
import { InventoryModal } from '../inventory/inventory-modal';
import '../inventory/inventory-workspace.css';
import './workspace.css';
export function AdminWorkspace({
  children,
  kind = '',
}: {
  children: ReactNode;
  kind?: string;
}) {
  return <div className={'admin-workspace am-' + kind}>{children}</div>;
}
export function AdminHeader({
  title,
  description,
  section = 'Operasional',
  actions,
}: {
  title: string;
  description: string;
  section?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="am-header">
      <div>
        <p className="am-kicker">{section} / iRent</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="am-header-actions">{actions}</div>}
    </header>
  );
}
export function AdminBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'pink' | 'green' | 'amber' | 'red' | 'blue';
}) {
  return (
    <span className={'am-badge am-badge-' + tone}>
      <i />
      {children}
    </span>
  );
}
export function AdminHint({ children }: { children: ReactNode }) {
  return (
    <p className="am-hint">
      <InfoCircledIcon aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
export function AdminEmpty({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="am-empty">
      <CheckCircledIcon aria-hidden="true" />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
  );
}
export function AdminTabs({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="am-tabs" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
export function AdminModal({
  title,
  description,
  busy,
  onClose,
  children,
}: {
  title: string;
  description: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <InventoryModal
      title={title}
      description={description}
      busy={busy}
      onClose={onClose}
    >
      {children}
    </InventoryModal>
  );
}
export { PlusIcon };
