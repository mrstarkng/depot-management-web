import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 sm:px-4 py-3 border-t border-[#E0E0E0] text-[12px] text-[#666]">
      <div class="flex items-center gap-2">
        <span>Rows per page:</span>
        <select [ngModel]="itemsPerPage"
                (ngModelChange)="itemsPerPageChange.emit($event); pageChange.emit(1)"
                class="border border-[#CCC] rounded px-1.5 py-1 text-[12px] bg-white">
          @for (opt of [10, 25, 50]; track opt) {
            <option [value]="opt">{{ opt }}</option>
          }
        </select>
      </div>
      <div class="flex items-center gap-2">
        <span>{{ rangeStart }}–{{ rangeEnd }} of {{ totalItems }}</span>
        <button (click)="pageChange.emit(currentPage - 1)"
                [disabled]="currentPage <= 1"
                class="px-2 py-1 border border-[#CCC] rounded hover:bg-[#F5F5F5] disabled:opacity-40 disabled:cursor-not-allowed">
          <i class="pi pi-chevron-left text-[10px]"></i>
        </button>
        <button (click)="pageChange.emit(currentPage + 1)"
                [disabled]="currentPage >= totalPages"
                class="px-2 py-1 border border-[#CCC] rounded hover:bg-[#F5F5F5] disabled:opacity-40 disabled:cursor-not-allowed">
          <i class="pi pi-chevron-right text-[10px]"></i>
        </button>
      </div>
    </div>
  `
})
export class PaginationComponent {
  @Input() currentPage = 1;
  @Input() totalItems = 0;
  @Input() itemsPerPage = 10;
  @Output() pageChange = new EventEmitter<number>();
  @Output() itemsPerPageChange = new EventEmitter<number>();

  get totalPages() { return Math.ceil(this.totalItems / this.itemsPerPage) || 1; }
  get rangeStart() { return this.totalItems === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1; }
  get rangeEnd() { return Math.min(this.currentPage * this.itemsPerPage, this.totalItems); }
}
