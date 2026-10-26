import { AppHeader } from "@/components/app-header";
import { LoginForm } from "@/features/auth/login-form";
export default function LoginPage() {
  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <LoginForm />
      </main>
    </>
  );
}
