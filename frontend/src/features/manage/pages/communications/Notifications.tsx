import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Calendar, 
  UserPlus, 
  Globe, 
  Filter, 
  RefreshCcw,
  Clock,
  MapPin,
  User
} from 'lucide-react';
import { useClinicBranches } from '@/features/clinics/hooks/useClinicBranches';
import { notificationsApi } from '@/features/notifications/services/notifications.api';
import type { Notification, NotificationType } from '@/features/notifications/types/notifications.types';
import { formatDistanceToNow, format } from 'date-fns';

export const Notifications: React.FC = () => {
  const { branches, loading: branchesLoading } = useClinicBranches();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [branchFilter, setBranchFilter] = useState<number | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const params: any = {};
      
      if (branchFilter !== 'all') {
        params.branch = branchFilter;
      }
      
      if (typeFilter !== 'all') {
        params.notification_type = typeFilter;
      }

      if (unreadOnly) {
        params.is_read = false;
      }

      // Calculate dates
      if (dateFilter !== 'all') {
        const now = new Date();
        let fromDate = new Date();
        if (dateFilter === 'today') {
          fromDate.setHours(0, 0, 0, 0);
        } else if (dateFilter === 'week') {
          fromDate.setDate(now.getDate() - 7);
        } else if (dateFilter === 'month') {
          fromDate.setMonth(now.getMonth() - 1);
        }
        params.date_from = fromDate.toISOString().split('T')[0];
      }

      const res = await notificationsApi.getAll(params);
      setNotifications(res.results);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [dateFilter, branchFilter, typeFilter, unreadOnly]);

  const markAsRead = async (id: number) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'NEW_BOOKING': return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'NEW_CLIENT': return <UserPlus className="w-5 h-5 text-green-600" />;
      case 'ONLINE_BOOKING': return <Globe className="w-5 h-5 text-purple-600" />;
      case 'DAILY_SUMMARY': return <Activity className="w-5 h-5 text-gray-600" />;
      default: return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const getIconBg = (type: NotificationType) => {
    switch (type) {
      case 'NEW_BOOKING': return 'bg-blue-100';
      case 'NEW_CLIENT': return 'bg-green-100';
      case 'ONLINE_BOOKING': return 'bg-purple-100';
      default: return 'bg-gray-100';
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-pink-600" />
            Clinic Activity Feed
          </h2>
          <p className="text-gray-500 mt-1">Real-time updates on appointments, patients, and portal bookings.</p>
        </div>
        <button 
          onClick={fetchActivities}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          title="Refresh Feed"
        >
          <RefreshCcw className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Filter className="w-4 h-4" />
          Filters:
        </div>

        <select 
          value={dateFilter} 
          onChange={e => setDateFilter(e.target.value as any)}
          className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-pink-500 focus:border-pink-500 p-2"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>

        <select 
          value={branchFilter} 
          onChange={e => setBranchFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-pink-500 focus:border-pink-500 p-2"
        >
          <option value="all">All Branches</option>
          {!branchesLoading && branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select 
          value={typeFilter} 
          onChange={e => setTypeFilter(e.target.value as any)}
          className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-pink-500 focus:border-pink-500 p-2"
        >
          <option value="all">All Event Types</option>
          <option value="NEW_BOOKING">New Appointment</option>
          <option value="NEW_CLIENT">New Client</option>
          <option value="ONLINE_BOOKING">New Online Booking</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer ml-auto">
          <input 
            type="checkbox" 
            checked={unreadOnly} 
            onChange={e => setUnreadOnly(e.target.checked)}
            className="rounded text-pink-600 focus:ring-pink-500"
          />
          Unread Only
        </label>
      </div>

      {/* Feed Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading activities...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Activity className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium">No recent activities</p>
            <p className="text-sm">Try adjusting your filters to see more events.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map(notification => (
              <div 
                key={notification.id} 
                className={`p-5 flex gap-4 transition-colors hover:bg-gray-50 ${!notification.is_read ? 'bg-blue-50/30' : ''}`}
                onClick={() => !notification.is_read && markAsRead(notification.id)}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${getIconBg(notification.notification_type)}`}>
                  {getIcon(notification.notification_type)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className={`text-base font-semibold ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                        {notification.title}
                      </h4>
                      <p className="text-gray-600 mt-1 text-sm">{notification.message}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-medium text-gray-500">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                      <p className="text-xs text-gray-400 mt-1 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(notification.created_at), 'h:mm a')}
                      </p>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="mt-3 flex flex-wrap gap-4 text-xs font-medium text-gray-500">
                    {notification.clinic_branch_name && (
                      <span className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-md">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {notification.clinic_branch_name}
                      </span>
                    )}
                    {notification.practitioner_name && (
                      <span className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-md">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {notification.practitioner_name}
                      </span>
                    )}
                    
                    {!notification.is_read && (
                      <span className="flex items-center gap-1 text-blue-600 ml-auto">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        New
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};