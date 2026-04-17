import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DepotService } from '../../core/services/depot.service';
import { Customer } from '../../core/models/depot.models';
import { PaginationComponent } from '../../core/components';

type SortKey = 'taxCode' | 'name';

@Component({
  selector: 'depot-customers',
  standalone: true,
  imports: [FormsModule, PaginationComponent],
  templateUrl: './customers.component.html',
})
export class CustomersComponent implements OnInit {
  data: Customer[] = [];
  loading = true;
  search = '';
  sortKey: SortKey = 'taxCode';
  sortDir: 'asc' | 'desc' = 'asc';
  page = 1;
  perPage = 10;

  constructor(private depotService: DepotService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.depotService.getCustomers().subscribe({
      next: (data) => {
        this.data = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  get filtered(): Customer[] {
    const query = this.search.trim().toLowerCase();
    return this.data.filter(customer => !query
      || customer.taxCode.toLowerCase().includes(query)
      || customer.name.toLowerCase().includes(query));
  }

  get sorted(): Customer[] {
    return [...this.filtered].sort((left, right) => {
      const a = String(left[this.sortKey] ?? '');
      const b = String(right[this.sortKey] ?? '');
      const result = a.localeCompare(b);
      return this.sortDir === 'asc' ? result : -result;
    });
  }

  get paginated(): Customer[] {
    const start = (this.page - 1) * this.perPage;
    return this.sorted.slice(start, start + this.perPage);
  }

  handleSort(key: SortKey) {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
      return;
    }

    this.sortKey = key;
    this.sortDir = 'asc';
  }
}
