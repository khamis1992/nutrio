'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { User } from '@/types';
import { Search, Plus, Edit, Trash2, Eye } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'view' | 'edit' | 'create'>('view');

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'danger';
      case 'restaurant_owner':
        return 'primary';
      case 'gym_owner':
        return 'success';
      case 'driver':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'مدير النظام';
      case 'restaurant_owner':
        return 'مالك مطعم';
      case 'gym_owner':
        return 'مالك صالة';
      case 'driver':
        return 'سائق';
      case 'customer':
        return 'عميل';
      default:
        return role;
    }
  };

  const openModal = (type: 'view' | 'edit' | 'create', user?: User) => {
    setModalType(type);
    setSelectedUser(user || null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  if (loading) {
    return (
      <DashboardLayout title="إدارة المستخدمين" userRole="admin">
        <div className="flex items-center justify-center h-64">
          <div className="loading-spinner" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="إدارة المستخدمين" userRole="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">المستخدمين</h2>
            <p className="text-gray-600">إدارة جميع مستخدمي النظام</p>
          </div>
          <Button onClick={() => openModal('create')}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة مستخدم جديد
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="البحث بالبريد الإلكتروني..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>قائمة المستخدمين ({filteredUsers.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>البريد الإلكتروني</th>
                    <th>الأدوار</th>
                    <th>تاريخ التسجيل</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div>
                          <p className="font-medium text-gray-900">{user.email}</p>
                          <p className="text-sm text-gray-500">ID: {user.id.slice(0, 8)}...</p>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {user.user_roles.map((role) => (
                            <Badge
                              key={role}
                              variant={getRoleBadgeVariant(role)}
                            >
                              {getRoleLabel(role)}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className="text-sm text-gray-600">
                          {new Date(user.created_at).toLocaleDateString('ar-SA')}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openModal('view', user)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openModal('edit', user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* User Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={
            modalType === 'create' ? 'إضافة مستخدم جديد' :
            modalType === 'edit' ? 'تعديل المستخدم' :
            'تفاصيل المستخدم'
          }
          size="lg"
        >
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <label className="label">البريد الإلكتروني</label>
                <p className="text-gray-900">{selectedUser.email}</p>
              </div>
              <div>
                <label className="label">الأدوار</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedUser.user_roles.map((role) => (
                    <Badge
                      key={role}
                      variant={getRoleBadgeVariant(role)}
                    >
                      {getRoleLabel(role)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">تاريخ التسجيل</label>
                <p className="text-gray-900">
                  {new Date(selectedUser.created_at).toLocaleDateString('ar-SA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}
