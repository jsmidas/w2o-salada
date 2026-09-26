import { prisma } from "@repo/db";
import { auth } from "../../../auth";
import PermissionsClient from "./PermissionsClient";

export const dynamic = "force-dynamic";

export default async function PermissionsPage() {
  const [session, members] = await Promise.all([
    auth(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        permissions: true,
        provider: true,
      },
    }),
  ]);

  const currentUserId = (session?.user as { id?: string } | undefined)?.id ?? "";

  return (
    <PermissionsClient
      currentUserId={currentUserId}
      initialMembers={JSON.parse(JSON.stringify(members))}
    />
  );
}
