import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-section-divider',
  standalone: true,
  template: `
    <div class="flex items-center gap-2 my-3">
      <span class="text-[11px] font-semibold text-[#888] uppercase tracking-wide whitespace-nowrap">{{ label }}</span>
      <div class="flex-1 border-t border-[#E0E0E0]"></div>
    </div>
  `
})
export class SectionDividerComponent {
  @Input() label = '';
}
