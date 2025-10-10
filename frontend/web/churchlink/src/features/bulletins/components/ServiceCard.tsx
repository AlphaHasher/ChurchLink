import React from 'react';
import { Card } from '@/shared/components/ui/card';
import { ServiceBulletin } from '@/shared/types/ChurchBulletin';

interface ServiceCardProps {
	service: ServiceBulletin;
	onClick?: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, onClick }) => {
	const formatServiceTime = (dayOfWeek: string, timeOfDay: string): string => {
		// Convert 24-hour time to 12-hour format with AM/PM
		const [hours, minutes] = timeOfDay.split(':').map(Number);
		const period = hours >= 12 ? 'PM' : 'AM';
		const displayHours = hours % 12 || 12;
		return `${dayOfWeek} at ${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
	};

	return (
		<Card
			className="group overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1 relative border-l-4 border-l-black border-r-4 border-r-black bg-gradient-to-br from-gray-50 via-white to-gray-100 p-6"
			onClick={onClick}
		>
			<div className="flex flex-col gap-3">
				{/* Header with title */}
				<div className="flex items-start justify-between gap-3">
					<div className="flex-1">
						<h3 className="text-lg font-semibold leading-tight text-gray-900">
							{service.title}
						</h3>
					</div>
				</div>

				{/* Service time */}
				<div className="flex items-center gap-2 text-sm font-medium text-gray-700">
					<svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{formatServiceTime(service.day_of_week, service.time_of_day)}</span>
				</div>

				{/* Description */}
				{service.description && (
					<p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
						{service.description}
					</p>
				)}
			</div>
		</Card>
	);
};
