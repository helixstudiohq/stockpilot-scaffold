import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminUsers, useStores } from "@/hooks/use-data";
import { KeyRound, ShieldCheck, Store as StoreIcon, Users } from "lucide-react";

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/30",
  manager: "bg-status-low/15 text-status-low border-status-low/30",
  viewer: "bg-secondary text-secondary-foreground border-border",
};

const ROLE_MATRIX = [
  { role: "Admin", scope: "Full access: users, settings, all stores, ordering" },
  { role: "Manager", scope: "Operate inventory and orders for assigned stores" },
  { role: "Viewer", scope: "Read-only dashboards, analytics and reports" },
];

export default function Admin() {
  const users = useAdminUsers();
  const stores = useStores();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspace users, roles and organization settings.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-none">
          <CardContent className="flex items-center gap-3 px-5 pt-5">
            <div className="flex size-10 items-center justify-center rounded-md border border-border bg-secondary text-primary">
              <Users className="size-5" />
            </div>
            <div>
              <p className="font-mono-tight text-xl font-bold">
                {users ? users.length : "—"}
              </p>
              <p className="text-xs text-muted-foreground">workspace users</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="flex items-center gap-3 px-5 pt-5">
            <div className="flex size-10 items-center justify-center rounded-md border border-border bg-secondary text-primary">
              <StoreIcon className="size-5" />
            </div>
            <div>
              <p className="font-mono-tight text-xl font-bold">
                {stores ? stores.length : "—"}
              </p>
              <p className="text-xs text-muted-foreground">stores in organization</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="flex items-center gap-3 px-5 pt-5">
            <div className="flex size-10 items-center justify-center rounded-md border border-border bg-secondary text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="font-mono-tight text-xl font-bold">RBAC</p>
              <p className="text-xs text-muted-foreground">role model (demo)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base tracking-tight">Users</CardTitle>
          <CardDescription>
            Everyone who has signed in to this workspace. Roles default to
            viewer; an admin promotion flow is on the roadmap.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {users === undefined ? (
            <div className="flex flex-col gap-2 px-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No users yet — sign in to populate the roster.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="pr-6 text-right">Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="pl-6 font-medium">
                      {user.name ?? (user.isAnonymous ? "Guest session" : "Operator")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono-tight text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Badge
                        variant="outline"
                        className={`font-mono-tight capitalize ${ROLE_BADGE[user.role] ?? ROLE_BADGE.viewer}`}
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base tracking-tight">
            <KeyRound className="size-4 text-primary" /> Role model
          </CardTitle>
          <CardDescription>
            Designed around three roles; enforcement points are documented for
            the FastAPI backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {ROLE_MATRIX.map((entry) => (
            <div
              key={entry.role}
              className="flex flex-col gap-0.5 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-mono-tight text-sm font-semibold">{entry.role}</span>
              <span className="text-xs text-muted-foreground">{entry.scope}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
