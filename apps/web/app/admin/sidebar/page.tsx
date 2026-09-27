import { prisma } from "@repo/db";
import SidebarConfigClient from "./SidebarConfigClient";

export const dynamic = "force-dynamic";

import { DEFAULT_SIDEBAR_CONFIG as DEFAULT_CONFIG } from "../../lib/sidebar-defaults";

export default async function SidebarAdminPage() {
  const row = await prisma.setting.findUnique({ where: { key: "sidebar.config" } });

  let initialConfig = DEFAULT_CONFIG;
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      initialConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        support: { ...DEFAULT_CONFIG.support, ...(parsed.support || {}) },
      };
    } catch {
      initialConfig = DEFAULT_CONFIG;
    }
  }

  return <SidebarConfigClient initialConfig={initialConfig} />;
}
