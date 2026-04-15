'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Shield, Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight,
  LayoutDashboard, ShoppingCart, Package, FolderTree, Warehouse, Ticket,
  Image, UserCheck, UserCog, Lock, Settings, BarChart3, CreditCard, X,
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
]

const MODULE_LABELS: Record<AdminModule, string> = {
  dashboard: 'Dashboard', pedidos: 'Pedidos', productos: 'Productos',
  categorias: 'Categorías', inventario: 'Inventario', cupones: 'Cupones',
  multimedia: 'Multimedia', clientes: 'Clientes', usuarios: 'Usuarios',
  roles: 'Roles', configuracion: 'Configuración', analytics: 'Analytics',
  pagos: 'Pagos',
}

const MODULE_ICONS: Record<AdminModule, React.ElementType> = {
  dashboard: LayoutDashboard, pedidos: ShoppingCart, productos: Package,
  categorias: FolderTree, inventario: Warehouse, cupones: Ticket,
  multimedia: Image, clientes: UserCheck, usuarios: Users,
  roles: Shield, configuracion: Settings, analytics: BarChart3,
  pagos: CreditCard,
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
    if (!roleId) return null
    return roles.find((r) => r.id === roleId) ?? null
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
            {users.length} usuarios · {roles.length} roles
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
                    <SelectItem value="all">Todos los roles</SelectItem>
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
                    <TableHead className="font-semibold text-primary-dark">Nombre</TableHead>
                    <TableHead className="font-semibold text-primary-dark">Email</TableHead>
                    <TableHead className="font-semibold text-primary-dark">Rol</TableHead>
                    <TableHead className="font-semibold text-primary-dark">Estado</TableHead>
                    <TableHead className="font-semibold text-primary-dark">Ultimo acceso</TableHead>
                    <TableHead className="font-semibold text-primary-dark text-right">Acciones</TableHead>
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
                          className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
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
                                style={{
                                  backgroundColor: `${role.color}18`,
                                  color: role.color,
                                }}
                              >
                                {role.name}
                              </Badge>
                            ) : (
                              <span className="text-gray-300 text-sm">—</span>
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
                        className="w-3 h-3 rounded-full"
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary-dark">
              {editingUser ? 'Editar usuario' : 'Nuevo usuario'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Nombre completo <span className="text-red-400">*</span>
              </label>
              <Input
                value={userForm.full_name}
                onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                placeholder="Juan Perez"
              />
            </div>

            {!editingUser && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <Input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Contrasena <span className="text-red-400">*</span>
                  </label>
                  <Input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Minimo 8 caracteres"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Telefono</label>
              <Input
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                placeholder="+52 55 1234 5678"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Rol</label>
              <Select
                value={userForm.admin_role_id || 'none'}
                onValueChange={(v) => setUserForm({ ...userForm, admin_role_id: !v || v === 'none' ? '' : v })}
              >
                <SelectTrigger className="border-gray-200">
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin rol</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setUserDialogOpen(false)}
                className="border-gray-200"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveUser}
                className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-semibold"
              >
                {editingUser ? 'Guardar cambios' : 'Crear usuario'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Role Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-primary-dark">
              {editingRole ? 'Editar rol' : 'Nuevo rol'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Name & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <Input
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="Ej: Editor"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Descripcion</label>
                <Input
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  placeholder="Breve descripcion del rol"
                />
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Color</label>
              <div className="flex gap-2">
                {ROLE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setRoleForm({ ...roleForm, color: c })}
                    className={cn(
                      'w-7 h-7 rounded-full transition-all',
                      roleForm.color === c ? 'ring-2 ring-offset-2 ring-primary-cyan scale-110' : 'hover:scale-105'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Permissions Matrix */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">Permisos por modulo</label>
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1fr_repeat(4,64px)] sm:grid-cols-[1fr_repeat(4,80px)] bg-gray-50 px-4 py-2.5 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Modulo</span>
                  {PERMISSION_LEVELS.map((level) => (
                    <span key={level} className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">
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
                        'grid grid-cols-[1fr_repeat(4,64px)] sm:grid-cols-[1fr_repeat(4,80px)] px-4 py-2.5 items-center',
                        i < ALL_MODULES.length - 1 && 'border-b border-gray-50'
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm text-primary-dark font-medium">
                        <Icon className="w-4 h-4 text-gray-400" />
                        {MODULE_LABELS[mod]}
                      </span>
                      {PERMISSION_LEVELS.map((level) => (
                        <div key={level} className="flex justify-center">
                          <button
                            onClick={() => updatePermission(mod, level)}
                            className={cn(
                              'w-5 h-5 rounded-full border-2 transition-all',
                              roleForm.permissions[mod] === level
                                ? cn(PERMISSION_COLORS[level], 'border-transparent')
                                : 'border-gray-200 hover:border-gray-300 bg-white'
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

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setRoleDialogOpen(false)}
                className="border-gray-200"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveRole}
                className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-semibold"
              >
                {editingRole ? 'Guardar cambios' : 'Crear rol'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Role Confirm ─────────────────────────────────────────────── */}
      <Dialog open={!!deleteRoleConfirm} onOpenChange={() => setDeleteRoleConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-primary-dark">Eliminar rol</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 py-2">
            Esta accion no se puede deshacer. Los usuarios con este rol perderan sus permisos.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteRoleConfirm(null)}
              className="border-gray-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => deleteRoleConfirm && handleDeleteRole(deleteRoleConfirm)}
              className="bg-red-500 text-white hover:bg-red-600 font-semibold"
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
