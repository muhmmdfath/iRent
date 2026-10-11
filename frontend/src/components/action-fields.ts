import type { ActionField } from './business-form';
export const reasonField: ActionField = {
  name: 'reason',
  label: 'Alasan',
  type: 'textarea',
  min: 5,
  max: 1000,
};
