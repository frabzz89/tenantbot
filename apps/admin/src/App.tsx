import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { AdminLayout } from './components/AdminLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { OnboardingPage } from './pages/onboarding/OnboardingPage'
import { DashboardPage } from './pages/admin/DashboardPage'
import { ProprietaPage } from './pages/admin/ProprietaPage'
import { InquiliniPage } from './pages/admin/InquiliniPage'
import { ContrattiPage } from './pages/admin/ContrattiPage'
import { KbPage } from './pages/admin/KbPage'
import { TicketPage } from './pages/admin/TicketPage'
import { BotConfigPage } from './pages/admin/BotConfigPage'
import { UnitaPage } from './pages/admin/UnitaPage'
import { SettingsPage } from './pages/admin/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster richColors position="top-right" />
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Admin (protected) */}
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/properties" element={<ProprietaPage />} />
          <Route path="/unita" element={<UnitaPage />} />
          <Route path="/inquilini" element={<InquiliniPage />} />
          <Route path="/contratti" element={<ContrattiPage />} />
          <Route path="/kb" element={<KbPage />} />
          <Route path="/ticket" element={<TicketPage />} />
          <Route path="/bot" element={<BotConfigPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/broadcast" element={<BroadcastPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

// Pagine placeholder inline — espandibili
function BillingPage() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-4">Piano & Fatturazione</h1>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-500 mb-4">Gestisci il tuo piano di abbonamento tramite il portale Stripe.</p>
        <a
          href="#"
          className="inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          onClick={(e) => { e.preventDefault(); alert('Stripe Customer Portal — da configurare con STRIPE_SECRET_KEY') }}
        >
          Apri portale fatturazione
        </a>
      </div>
    </div>
  )
}

function BroadcastPage() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-4">Broadcast</h1>
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Invia comunicazioni a tutti gli inquilini o a una proprietà specifica.
      </div>
    </div>
  )
}
