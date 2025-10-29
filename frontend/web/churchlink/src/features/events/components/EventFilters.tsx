import { Search, Filter, RefreshCw } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuCheckboxItem, 
  DropdownMenuTrigger 
} from '@/shared/components/ui/dropdown-menu';
import { EventFilters } from '../types/myEvents';
import { useLocalize } from '@/shared/utils/localizationUtils';

interface EventFiltersProps {
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  onRefresh?: () => void;
}

export function EventFiltersComponent({ filters, onFiltersChange, onRefresh }: EventFiltersProps) {
  const localize = useLocalize();
  const updateFilter = (key: keyof EventFilters, value: boolean | string) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder={localize("Search events...")}
          value={filters.searchTerm}
          onChange={(e) => updateFilter('searchTerm', e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {localize('Filters')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuCheckboxItem
            checked={filters.showUpcoming}
            onCheckedChange={(checked) => updateFilter('showUpcoming', checked)}
          >
            {localize('Show Upcoming Events')}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={filters.showPast}
            onCheckedChange={(checked) => updateFilter('showPast', checked)}
          >
            {localize('Show Past Events')}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={filters.showFamily}
            onCheckedChange={(checked) => updateFilter('showFamily', checked)}
          >
            {localize('Include Family Events')}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Refresh Button */}
      <div className="flex gap-2">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {localize('Refresh')}
          </Button>
        )}
      </div>
    </div>
  );
}