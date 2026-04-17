import { Component, Input } from '@angular/core';

export type BadgeVariant =
  | 'Active' | 'Inactive' | 'InDepot' | 'Released' | 'Pending' | 'Expired'
  | 'Cancelled' | 'Completed' | 'Normal' | 'Damaged' | 'Physical' | 'Virtual'
  | 'Fulfilled';

const variantClasses: Record<BadgeVariant, string> = {
  Active:    'bg-[#DFF0D8] text-[#3C763D] border border-[#3C763D]/30',
  Normal:    'bg-[#DFF0D8] text-[#3C763D] border border-[#3C763D]/30',
  InDepot:   'bg-[#D9EDF7] text-[#0275D8] border border-[#0275D8]/30',
  Physical:  'bg-[#D9EDF7] text-[#0275D8] border border-[#0275D8]/30',
  Completed: 'bg-[#D9EDF7] text-[#0275D8] border border-[#0275D8]/30',
  Fulfilled: 'bg-[#D9EDF7] text-[#0275D8] border border-[#0275D8]/30',
  Pending:   'bg-[#FCF8E3] text-[#8A6D3B] border border-[#F0AD4E]/30',
  Damaged:   'bg-[#FCF8E3] text-[#8A6D3B] border border-[#F0AD4E]/30',
  Expired:   'bg-[#F2DEDE] text-[#A94442] border border-[#D9534F]/30',
  Released:  'bg-[#F5F5F5] text-[#777] border border-[#999]/30',
  Cancelled: 'bg-[#F5F5F5] text-[#777] border border-[#999]/30',
  Inactive:  'bg-[#F5F5F5] text-[#777] border border-[#999]/30',
  Virtual:   'bg-[#F5F5F5] text-[#777] border border-[#999]/30',
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span [class]="classes">{{ label || status }}</span>`,
})
export class StatusBadgeComponent {
  @Input() status: BadgeVariant = 'Active';
  @Input() label?: string;

  get classes(): string {
    return `inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap ${variantClasses[this.status] ?? variantClasses['Inactive']}`;
  }
}
