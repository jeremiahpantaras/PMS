export interface MenuItem {
  id: string;
  label: string;
  path: string;
  component: React.ComponentType;
}

export interface ManageCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;    // icon container bg, e.g. 'bg-indigo-500'
  bgColor: string;  // card header bg, e.g. 'bg-indigo-50'
  items: MenuItem[];
}