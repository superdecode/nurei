'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Shield, Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight,
  LayoutDashboard, ShoppingCart, Package, FolderTree, Warehouse, Ticket,
  Image, UserCheck, UserCog, Lock, Settings, BarChart3, CreditCard, X, Check, Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type {
  AdminRole, UserProfile, AdminModule, PermissionLevel,
} from '@/types'

// ─── Constants ───────────────────────────────────────────────────────────────

type Tab = 'usuarios' | 'roles'

const ALL_MODULES: AdminModule[] = [
  'dashboard', 'pedidos', 'productos', 'categorias', 'inventario',
  'cupones', 'multimedia', 'clientes', 'usuarios', 'roles',
  'configuracion', 'analytics', 'pagos',
  'afiliados',
]

const MODULE_LABELS: Record<AdminModule, string> = {
  dashboard: 'Dashboard', pedidos: 'Pedidos', productos: 'Productos',
  categorias: 'Categorías', inventario: 'Inventario', cupones: 'Cupones',
  multimedia: 'Multimedia', clientes: 'Clientes', usuarios: 'Usuarios',
  roles: 'Roles', configuracion: 'Configuración', analytics: 'Analytics',
  pagos: 'Pagos', afiliados: 'Afiliados',
}

const MODULE_ICONS: Record<AdminModule, React.ElementType> = {
  dashboard: LayoutDashboard, pedidos: ShoppingCart, productos: Package,
  categorias: FolderTree, inventario: Warehouse, cupones: Ticket,
  multimedia: Image, clientes: UserCheck, usuarios: Users,
  roles: Shield, configuracion: Settings, analytics: BarChart3,
  pagos: CreditCard, afiliados: Share2,
}

const PERMISSION_LEVELS: PermissionLevel[] = ['total', 'escritura', 'lectura', 'sin_acceso']

const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  total: 'Total', escritura: 'Editar', lectura: 'Ver', sin_acceso: 'Sin acceso',
}

const PERMISSION_COLORS: Record<PermissionLevel, string> = {
  total: 'bg-emerald-500', escritura: 'bg-blue-500',
  lectura: 'bg-amber-500', sin_acceso: 'bg-gray-300',
}

const DEFAULT_PERMISSIONS: Record<AdminModule, PermissionLevel> = Object.fromEntries(
  ALL_MODULES.map((m) => [m, 'sin_acceso' as PermissionLevel])
) as Record<AdminModule, PermissionLevel>

// ─── User Form ───────────────────────────────────────────────────────────────

interface UserForm {
  full_name: string
  email: string
  password: string
  phone: string
  admin_role_id: string
}

const EMPTY_USER_FORM: UserForm = {
  full_name: '', email: '', password: '', phone: '', admin_role_id: '',
}

// ─── Role Form ───────────────────────────────────────────────────────────────

interface RoleForm {
  name: string
  description: string
  color: string
  permissions: Record<AdminModule, PermissionLevel>
}

const EMPTY_ROLE_FORM: RoleForm = {
  name: '', description: '', color: '#00E5FF', permissions: { ...DEFAULT_PERMISSIONS },
}

const ROLE_COLORS = [
  '#00E5FF', '#8B5CF6', '#EF4444', '#F59E0B', '#10B981',
  '#EC4899', '#6366F1', '#0A1F2F',
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const [tab, setTab] = useState<Tab>('usuarios')
  const [users, setUsers] = useState<(UserProfile & { email?: string })[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(true)

  // Users state
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all')
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<(UserProfile & { email?: string }) | null>(null)
  const [userForm, setUserForm] = useState<UserForm>(EMPTY_USER_FORM)

  // Delete user
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<(UserProfile & { email?: string }) | null>(null)
  const [deletingUser, setDeletingUser] = useState(false)

  // Roles state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null)
  const [roleForm, setRoleForm] = useState<RoleForm>(EMPTY_ROLE_FORM)
  const [deleteRoleConfirm, setDeleteRoleConfirm] = useState<string | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users')
      const { data } = await res.json()
      setUsers(data ?? [])
    } catch {
      toast.error('Error al cargar usuarios')
    }
  }, [])

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/roles')
      const { data } = await res.json()
      setRoles(data ?? [])
    } catch {
      toast.error('Error al cargar roles')
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchUsers(), fetchRoles()]).finally(() => setLoading(false))
  }, [fetchUsers, fetchRoles])

  // ── User Handlers ────────────────────────────────────────────────────────

  const filteredUsers = users.filter((u) => {
    const matchesSearch = (u.full_name ?? '').toLowerCase().includes(userSearch.toLowerCase())
    const matchesRole = userRoleFilter === 'all' || u.admin_role_id === userRoleFilter
    return matchesSearch && matchesRole
  })

  const openCreateUser = () => {
    setEditingUser(null)
    setUserForm(EMPTY_USER_FORM)
    setUserDialogOpen(true)
  }

  const openEditUser = (user: UserProfile & { email?: string }) => {
    setEditingUser(user)
    setUserForm({
      full_name: user.full_name ?? '',
      email: user.email ?? '',
      password: '',
      phone: user.phone ?? '',
      admin_role_id: user.admin_role_id ?? '',
    })
    setUserDialogOpen(true)
  }

  const handleSaveUser = async () => {
    if (!userForm.full_name.trim() || (!editingUser && (!userForm.email.trim() || !userForm.password.trim()))) {
      toast.error('Completa los campos requeridos')
      return
    }

    try {
      if (editingUser) {
        const res = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: userForm.full_name,
            phone: userForm.phone || null,
            admin_role_id: userForm.admin_role_id || null,
            ...(userForm.email !== editingUser.email ? { email: userForm.email } : {}),
            ...(userForm.password ? { password: userForm.password } : {}),
          }),
        })
        if (!res.ok) throw new Error()
        toast.success('Usuario actualizado')
      } else {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userForm),
        })
        if (!res.ok) throw new Error()
        toast.success('Usuario creado')
      }
      setUserDialogOpen(false)
      fetchUsers()
    } catch {
      toast.error('Error al guardar usuario')
    }
  }

  const toggleUserActive = async (user: UserProfile) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !user.is_active }),
      })
      if (!res.ok) throw new Error()
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      toast.success(user.is_active ? 'Usuario desactivado' : 'Usuario activado')
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteUserConfirm) return
    setDeletingUser(true)
    try {
      const res = await fetch(`/api/admin/users/${deleteUserConfirm.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'No se pudo eliminar el usuario')
      toast.success('Usuario eliminado')
      setDeleteUserConfirm(null)
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar usuario')
    } finally {
      setDeletingUser(false)
    }
  }

  // ── Role Handlers ────────────────────────────────────────────────────────

  const openCreateRole = () => {
    setEditingRole(null)
    setRoleForm(EMPTY_ROLE_FORM)
    setRoleDialogOpen(true)
  }

  const openEditRole = (role: AdminRole) => {
    setEditingRole(role)
    setRoleForm({
      name: role.name,
      description: role.description ?? '',
      color: role.color,
      permissions: { ...DEFAULT_PERMISSIONS, ...role.permissions },
    })
    setRoleDialogOpen(true)
  }

  const updatePermission = (mod: AdminModule, level: PermissionLevel) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [mod]: level },
    }))
  }

  const handleSaveRole = async () => {
    if (!roleForm.name.trim()) {
      toast.error('El nombre del rol es requerido')
      return
    }

    try {
      const payload = {
        name: roleForm.name,
        description: roleForm.description || null,
        color: roleForm.color,
        permissions: roleForm.permissions,
      }

      if (editingRole) {
        const res = await fetch(`/api/admin/roles/${editingRole.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        toast.success('Rol actualizado')
      } else {
        const res = await fetch('/api/admin/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error()
        toast.success('Rol creado')
      }
      setRoleDialogOpen(false)
      fetchRoles()
    } catch {
      toast.error('Error al guardar rol')
    }
  }

  const handleDeleteRole = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/roles/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Rol eliminado')
      setDeleteRoleConfirm(null)
      fetchRoles()
    } catch {
      toast.error('Error al eliminar rol')
    }
  }

  const getRoleName = (roleId: string | null) => {
    if (!roleId || roleId === 'none') return null
    return roles.find((r) => r.id === roleId) || null
  }

  const countUsersWithRole = (roleId: string) =>
    users.filter((u) => u.admin_role_id === roleId).length

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-gray-400">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark flex items-center gap-2">
            <Users className="w-6 h-6 text-primary-cyan" />
            Usuarios y Roles
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Equipo con acceso al administrador ({users.length} usuarios · {roles.length} roles). Los clientes de la tienda se gestionan en Clientes.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 max-w-xs">
        {([
          { key: 'usuarios' as Tab, label: 'Usuarios', icon: Users },
          { key: 'roles' as Tab, label: 'Roles', icon: Shield },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center',
              tab === key
                ? 'bg-white text-primary-dark shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {tab === 'usuarios' ? (
          <motion.div
            key="usuarios"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <div className="flex gap-3 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className="pl-10 h-10 border-gray-200"
                  />
                </div>
                <Select value={userRoleFilter} onValueChange={(v) => setUserRoleFilter(v ?? 'all')}>
                  <SelectTrigger className="w-[180px] h-10 border-gray-200">
                    <SelectValue placeholder="Filtrar por rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={openCreateUser}
                className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-semibold gap-2"
              >
                <Plus className="w-4 h-4" />
                Nuevo usuario
              </Button>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl border border-gray-100 shadow-sm bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Nombre</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Email</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Rol</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Estado</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Ultimo acceso</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 py-12">
                        No se encontraron usuarios
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user, i) => {
                      const role = getRoleName(user.admin_role_id)
                      return (
                        <motion.tr
                          key={user.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="group border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                        >
                          <TableCell className="font-medium text-primary-dark">
                            {user.full_name ?? 'Sin nombre'}
                          </TableCell>
                          <TableCell className="text-gray-500 text-sm">
                            {user.email ?? <span className="text-gray-300 italic">via auth</span>}
                          </TableCell>
                          <TableCell>
                            {role ? (
                              <Badge
                                className="text-xs font-medium border-0"
                                style={role.color.startsWith('#') ? {
                                  backgroundColor: `${role.color}18`,
                                  color: role.color,
                                } : {}}
                                variant={role.color.startsWith('#') ? 'outline' : 'secondary'}
                              >
                                {role.name}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={user.is_active ? 'default' : 'secondary'}
                              className={cn(
                                'text-xs border-0',
                                user.is_active
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-gray-100 text-gray-400'
                              )}
                            >
                              {user.is_active ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {formatDate(user.last_login_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => toggleUserActive(user)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                title={user.is_active ? 'Desactivar' : 'Activar'}
                              >
                                {user.is_active
                                  ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                                  : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                              </button>
                              <button
                                onClick={() => openEditUser(user)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4 text-gray-500" />
                              </button>
                              <button
                                onClick={() => setDeleteUserConfirm(user)}
                                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="roles"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Toolbar */}
            <div className="flex justify-end">
              <Button
                onClick={openCreateRole}
                className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-semibold gap-2"
              >
                <Plus className="w-4 h-4" />
                Nuevo rol
              </Button>
            </div>

            {/* Roles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {roles.map((role, i) => (
                <motion.div
                  key={role.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl border border-gray-100 shadow-sm bg-white p-5 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: role.color }}
                      />
                      <h3 className="font-semibold text-primary-dark">{role.name}</h3>
                      {role.is_system && (
                        <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-500 border-0">
                          Sistema
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditRole(role)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                      {!role.is_system && (
                        <button
                          onClick={() => setDeleteRoleConfirm(role.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>

                  {role.description && (
                    <p className="text-sm text-gray-400 leading-relaxed">{role.description}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {countUsersWithRole(role.id)} usuario{countUsersWithRole(role.id) !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Permission summary */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {ALL_MODULES.map((mod) => {
                      const level = role.permissions?.[mod] ?? 'sin_acceso'
                      return (
                        <div
                          key={mod}
                          title={`${MODULE_LABELS[mod]}: ${PERMISSION_LABELS[level]}`}
                          className={cn(
                            'w-2 h-2 rounded-full',
                            PERMISSION_COLORS[level]
                          )}
                        />
                      )
                    })}
                  </div>
                </motion.div>
              ))}

              {roles.length === 0 && (
                <div className="col-span-full text-center text-gray-400 py-12">
                  No hay roles creados
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── User Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent size="lg" className="p-0 overflow-hidden flex flex-col">
          {/* Header Fixed */}
          <div className="bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#f59e0bb3] px-8 py-5 relative overflow-hidden flex-shrink-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-black/10 backdrop-blur-md flex items-center justify-center border border-black/5">
                <UserCog className="w-5 h-6 text-gray-900" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900 leading-tight">
                  {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                </DialogTitle>
                <p className="text-xs text-gray-900/60 font-medium">Gestiona permisos y accesos de usuario</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">
                Nombre completo <span className="text-red-400">*</span>
              </label>
              <Input
                value={userForm.full_name}
                onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                placeholder="Juan Pérez García"
                className="border-gray-200 shadow-sm"
              />
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Credenciales de acceso {editingUser && '(Dejar contraseña en blanco si no se desea cambiar)'}
              </p>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  Email <span className="text-red-400">*</span>
                </label>
                <Input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="correo@empresa.com"
                  className="border-gray-200 bg-white shadow-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  Nueva contraseña {!editingUser && <span className="text-red-400">*</span>}
                </label>
                <Input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  className="border-gray-200 bg-white shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Teléfono</label>
                <Input
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  placeholder="+52 55 1234 5678"
                  className="border-gray-200 shadow-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Rol de acceso</label>
                <Select
                  value={userForm.admin_role_id || 'none'}
                  onValueChange={(v) => setUserForm({ ...userForm, admin_role_id: v === 'none' ? '' : (v || '') })}
                >
                  <SelectTrigger className="border-gray-200 shadow-sm">
                    <SelectValue>
                      {roles.find(r => r.id === userForm.admin_role_id)?.name || (userForm.admin_role_id === '' || !userForm.admin_role_id ? 'Escoger rol' : userForm.admin_role_id)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Escoger rol</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="p-6 flex justify-end gap-3 border-t bg-gray-50/50 flex-shrink-0">
            <Button
              variant="ghost"
              onClick={() => setUserDialogOpen(false)}
              className="rounded-xl h-10 font-bold text-gray-500 hover:bg-gray-100 px-6"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveUser}
              className="bg-primary-dark text-white hover:bg-black font-bold rounded-xl h-10 px-8 shadow-md"
            >
              {editingUser ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Role Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent size="xl" className="p-0 overflow-hidden flex flex-col">
          {/* Header Fixed */}
          <div className="bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#f59e0bb3] px-8 py-5 relative overflow-hidden flex-shrink-0 border-b">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-black/10 backdrop-blur-md flex items-center justify-center border border-black/5">
                <Shield className="w-5 h-5 text-gray-900" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900 leading-tight">
                  {editingRole ? 'Editar Rol' : 'Nuevo Rol'}
                </DialogTitle>
                <p className="text-xs text-gray-900/60 font-medium whitespace-nowrap">Gestiona los niveles de acceso del sistema</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
            {/* Name & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <Input
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="Ej: Editor, Operador..."
                  className="h-10 border-gray-200 shadow-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Descripción</label>
                <Input
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  placeholder="Breve descripción del rol"
                  className="h-10 border-gray-200 shadow-sm"
                />
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2.5 block uppercase tracking-wide">Color identificador</label>
              <div className="flex gap-2">
                {ROLE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setRoleForm({ ...roleForm, color: c })}
                    className={cn(
                      'w-6 h-6 rounded-lg transition-all shadow-sm',
                      roleForm.color === c ? 'ring-2 ring-offset-2 ring-gray-700 scale-110' : 'hover:scale-105'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Permissions Matrix */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-3 block uppercase tracking-wide">Permisos por módulo</label>
              <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Header */}
                <div className="grid grid-cols-[1fr_repeat(4,90px)] bg-gray-50 px-5 py-3 border-b border-gray-200">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Módulo</span>
                  {PERMISSION_LEVELS.map((level) => (
                    <span key={level} className="text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                      {PERMISSION_LABELS[level]}
                    </span>
                  ))}
                </div>

                {/* Rows */}
                {ALL_MODULES.map((mod, i) => {
                  const Icon = MODULE_ICONS[mod]
                  return (
                    <div
                      key={mod}
                      className={cn(
                        'grid grid-cols-[1fr_repeat(4,90px)] px-5 py-3.5 items-center hover:bg-amber-50/40 transition-colors',
                        i < ALL_MODULES.length - 1 && 'border-b border-gray-100'
                      )}
                    >
                      <span className="flex items-center gap-2.5 text-sm text-gray-800 font-medium">
                        <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        {MODULE_LABELS[mod]}
                      </span>
                      {PERMISSION_LEVELS.map((level) => (
                        <div key={level} className="flex justify-center">
                          <button
                            onClick={() => updatePermission(mod, level)}
                            className={cn(
                              'w-4 h-4 rounded-full border-2 transition-all',
                              roleForm.permissions[mod] === level
                                ? cn(PERMISSION_COLORS[level], 'border-transparent scale-110')
                                : 'border-gray-200 hover:border-gray-400 bg-white'
                            )}
                          >
                            {roleForm.permissions[mod] === level && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-full h-full rounded-full"
                              />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="p-6 flex justify-end gap-3 border-t bg-gray-50/50 flex-shrink-0">
            <Button
              variant="ghost"
              onClick={() => setRoleDialogOpen(false)}
              className="rounded-xl h-10 font-bold text-gray-500 hover:bg-gray-100 px-6"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveRole}
              className="bg-primary-dark text-white hover:bg-black font-bold rounded-xl h-10 px-8 shadow-md"
            >
              <Check className="w-4 h-4 mr-2" />
              {editingRole ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete User Confirm ─────────────────────────────────────────────── */}
      <Dialog open={!!deleteUserConfirm} onOpenChange={() => setDeleteUserConfirm(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-rose-50 via-rose-100 to-amber-50 px-5 py-4 border-b border-rose-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/80 border border-rose-200 flex items-center justify-center shadow-sm">
                <Trash2 className="w-4 h-4 text-rose-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Eliminar usuario</h2>
                <p className="text-xs text-gray-500">Esta acción no se puede deshacer</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-600">
              ¿Eliminar a <span className="font-semibold text-gray-900">{deleteUserConfirm?.full_name ?? deleteUserConfirm?.email}</span>?
              <br /><span className="text-xs text-gray-400">El usuario perderá acceso inmediato al panel.</span>
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteUserConfirm(null)}
                className="flex-1 rounded-xl"
                disabled={deletingUser}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDeleteUser}
                disabled={deletingUser}
                className="flex-1 bg-rose-500 text-white hover:bg-rose-600 font-semibold rounded-xl"
              >
                {deletingUser ? 'Eliminando…' : 'Sí, eliminar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Role Confirm ─────────────────────────────────────────────── */}
      <Dialog open={!!deleteRoleConfirm} onOpenChange={() => setDeleteRoleConfirm(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-red-500 to-red-600 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Eliminar rol</h2>
                <p className="text-xs text-white/70">Esta acción no se puede deshacer</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-600">
              Los usuarios con este rol perderán sus permisos de acceso al panel.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteRoleConfirm(null)}
                className="flex-1 rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => deleteRoleConfirm && handleDeleteRole(deleteRoleConfirm)}
                className="flex-1 bg-red-500 text-white hover:bg-red-600 font-semibold rounded-xl"
              >
                Sí, eliminar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
