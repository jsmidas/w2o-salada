import { auth } from "../../auth";
import DriverClient from "./DriverClient";

export default async function DriverPage() {
  const session = await auth();
  const user = session?.user as { name?: string | null; role?: string } | undefined;
  return <DriverClient name={user?.name ?? "기사"} isAdmin={user?.role === "ADMIN"} />;
}
