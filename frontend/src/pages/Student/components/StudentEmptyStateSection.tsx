import { ReactNode } from 'react';
import EmptyState from '../../../components/ui/EmptyState';

interface StudentEmptyStateSectionProps {
  title: string;
  description: string;
  icon?: ReactNode;
}

export default function StudentEmptyStateSection({
  title,
  description,
  icon,
}: StudentEmptyStateSectionProps) {
  return <EmptyState icon={icon} title={title} description={description} />;
}
