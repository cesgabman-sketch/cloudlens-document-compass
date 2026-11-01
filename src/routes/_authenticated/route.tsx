import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { verificarAcceso } from "@/lib/acceso-local";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (!(await verificarAcceso())) throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
