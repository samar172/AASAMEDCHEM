import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-brand-50 px-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">AasaMedChem</h1>
          <p className="mt-1 text-sm text-slate-500">
            Inventory &amp; Order Management
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <div className="mt-6 rounded-md bg-slate-50 p-4 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Demo credentials</p>
          <p className="mt-1">
            Admin: <code>admin@aasamed.com</code> / <code>Admin@123</code>
          </p>
          <p>
            Seller: <code>seller@aasamed.com</code> / <code>Seller@123</code>
          </p>
        </div>
      </div>
    </main>
  );
}
