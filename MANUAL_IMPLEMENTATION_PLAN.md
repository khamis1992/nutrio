# Manual Implementation Plan for IP Management Features

## 1. Admin IP Management Page Implementation

File: `src/pages/admin/AdminIPManagement.tsx`

Replace the current content with a complete implementation that includes:

1. Two tabs: 'IP Logs' and 'Blocked IPs'
2. IP Logs tab should display:
   - Table with columns: User, IP Address, Country, City, Action (signup/login), Date, User Agent
   - Search/filter functionality by user, IP, country, date range
   - Pagination support
3. Blocked IPs tab should display:
   - Table with columns: IP Address, Reason, Blocked By, Date Blocked, Status
   - Ability to unblock IPs
   - Form to add new blocked IPs with reason
4. Use the same AdminLayout pattern as other admin pages
5. Fetch data from the `user_ip_logs` and `blocked_ips` tables
6. Implement RLS policies that only allow admins to access this data

## 2. AdminSidebar Update

File: `src/components/AdminSidebar.tsx`

Add the Globe icon import and IP Management link:

1. Add `Globe` to the import statement from lucide-react
2. Add `{ icon: Globe, label: "IP Management", to: "/admin/ip-management" }` to the navItems array before the Settings item

## 3. App.tsx Route Addition

File: `src/App.tsx`

Add the route for AdminIPManagement after the AdminDrivers route:

```jsx
<Route 
  path="/admin/ip-management" 
  element={
    <ProtectedRoute>
      <AdminIPManagement />
    </ProtectedRoute>
  } 
/>
```

Also add the lazy import at the top of the file:
```jsx
const AdminIPManagement = lazy(() => import("./pages/admin/AdminIPManagement"));
```

## 4. Auth.tsx Signup Integration

File: `src/pages/Auth.tsx`

Add IP checking to the signup flow:

1. Add state: `const [ipCheckLoading, setIpCheckLoading] = useState(false);`
2. Add function to check IP location using the Edge Function
3. Modify the handleSubmit function to check IP before signup
4. Show appropriate error messages if IP is blocked or not from Qatar

## 5. AuthContext.tsx Login Integration

File: `src/contexts/AuthContext.tsx`

Add IP checking to the login flow:

1. Modify the signIn function to check IP location using the Edge Function
2. Return an error if the IP is blocked
3. Log the login IP using the log-user-ip Edge Function
