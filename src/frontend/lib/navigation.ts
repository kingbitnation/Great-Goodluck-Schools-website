export type NavItem = {
  href: string
  label: string
  roles: string[]
  section?: string
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Overview', roles: ['SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'Accountant'], section: 'Main' },
  { href: '/super-admin/schools', label: 'Schools', roles: ['SuperAdmin'], section: 'Super Admin' },
  { href: '/super-admin/users', label: 'All Users', roles: ['SuperAdmin'], section: 'Super Admin' },
  { href: '/admin/students', label: 'Students', roles: ['SuperAdmin', 'SchoolAdmin'], section: 'School' },
  { href: '/admin/teachers', label: 'Teachers', roles: ['SuperAdmin', 'SchoolAdmin'], section: 'School' },
  { href: '/admin/classes', label: 'Classes', roles: ['SuperAdmin', 'SchoolAdmin'], section: 'School' },
  { href: '/admin/subjects', label: 'Subjects', roles: ['SuperAdmin', 'SchoolAdmin'], section: 'School' },
  { href: '/admin/sessions', label: 'Sessions', roles: ['SuperAdmin', 'SchoolAdmin'], section: 'School' },
  { href: '/admin/terms', label: 'Terms', roles: ['SuperAdmin', 'SchoolAdmin'], section: 'School' },
  { href: '/teacher', label: 'Teaching', roles: ['Teacher'], section: 'Teacher' },
  { href: '/student', label: 'My Portal', roles: ['Student'], section: 'Student' },
  { href: '/parent', label: 'My Children', roles: ['Parent'], section: 'Parent' },
  { href: '/accountant/fees', label: 'Fees & Payments', roles: ['Accountant', 'SuperAdmin', 'SchoolAdmin'], section: 'Finance' },
]

export function navForRole(role: string): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => item.roles.includes(role) || role === 'SuperAdmin'
  )
}

export const ROLE_HOME: Record<string, string> = {
  SuperAdmin: '/dashboard',
  SchoolAdmin: '/dashboard',
  Teacher: '/teacher',
  Student: '/student',
  Parent: '/parent',
  Accountant: '/accountant/fees',
}

export const ROLE_LABELS: Record<string, string> = {
  SuperAdmin: 'Super Admin',
  SchoolAdmin: 'School Admin',
  Teacher: 'Teacher',
  Student: 'Student',
  Parent: 'Parent',
  Accountant: 'Accountant',
}
