// app/user-dashboard/layout.tsx  (or the right route segment)
import FrontendLayout from "../../../layouts/FrontendLayout";

export default function UserDashboardRouteLayout({ children }: { children: React.ReactNode }) {
  return <FrontendLayout>{children}</FrontendLayout>;
}
