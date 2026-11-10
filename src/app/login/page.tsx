import { AppHeader } from "@/components/app-header";
import { LoginForm } from "@/features/auth/login-form";
export default function LoginPage() {
  return (
    <>
      <AppHeader nav={false} />
      <main className="flex-1">
        <LoginForm />
      </main>
    </>
  );
}
