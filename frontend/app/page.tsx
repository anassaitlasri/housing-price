'use client'

import Image from 'next/image'
import React, { useMemo, useState } from 'react'

// ---------- CONFIG ----------
const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'
const HERO_IMAGE_SRC = '/house1.jpg' // put your image in /public/house1.jpg


// ---------- TYPES ----------
interface FormState {
  area: number | '' // in square feet
  bedrooms: number | ''
  bathrooms: number | ''
  stories: number | ''
  parking: number | '' // spots
  furnishing_numeric: number | '' // 0 unfurnished, 1 semi, 2 fully
  luxury_score: number | '' // 0.0 - 1.0
  mainroad: boolean
  guestroom: boolean
  basement: boolean
  hotwaterheating: boolean
  airconditioning: boolean
  prefarea: boolean
}

type FeatureValue = number | string | boolean | null
interface PredictResponse {
  prediction: number
  used_features?: Record<string, FeatureValue>
}

type ErrorDetail =
  | string
  | {
      error?: unknown
      missing_keys?: string[]
    }

// ---------- UI UTILS ----------
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function SectionTitle({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <h2 className="text-base font-semibold tracking-tight text-gray-900">
      {children}
    </h2>
  )
}

function NumberInput(props: Readonly<{
  label: string
  value: number | ''
  onChange: (v: number | '') => void
  placeholder?: string
  step?: number | 'any'
  min?: number
  unit?: string
  hint?: string
}>) {
  const { label, value, onChange, placeholder, step = 'any', min, unit, hint } =
    props
  return (
    <label className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-800">{label}</span>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          className="w-full rounded-2xl border border-gray-200 bg-white/70 px-4 py-3 pr-16 text-sm shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
          value={value}
          onChange={(e) => {
            const v = e.target.value
            onChange(v === '' ? '' : Number(v))
          }}
          placeholder={placeholder}
          step={step}
          min={min}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 my-auto h-6 select-none rounded-full bg-gray-100 px-2 text-[11px] leading-6 text-gray-600">
            {unit}
          </span>
        )}
      </div>
    </label>
  )
}

function Toggle(props: Readonly<{
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}>) {
  const { checked, onChange, label } = props
  return (
    <label className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-gray-800">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2',
          checked ? 'bg-gray-900' : 'bg-gray-200',
        )}
        aria-pressed={checked}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </label>
  )
}

// ---------- PAGE ----------
export default function Page() {
  const [apiBase] = useState<string>(DEFAULT_API_BASE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PredictResponse | null>(null)

  const [form, setForm] = useState<FormState>({
    area: 2800,
    bedrooms: 3,
    bathrooms: 2,
    stories: 2,
    parking: 2,
    furnishing_numeric: 1,
    luxury_score: 0.5,
    mainroad: true,
    guestroom: false,
    basement: true,
    hotwaterheating: true,
    airconditioning: true,
    prefarea: true,
  })

  const rupeeFmt = useMemo(
    () =>
      new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true, // 12,34,567.00
      }),
    []
  )

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function presetSuburban() {
    setForm({
      area: 2200,
      bedrooms: 3,
      bathrooms: 2,
      stories: 2,
      parking: 2,
      furnishing_numeric: 1,
      luxury_score: 0.45,
      mainroad: false,
      guestroom: false,
      basement: true,
      hotwaterheating: true,
      airconditioning: true,
      prefarea: true,
    })
    setResult(null)
    setError(null)
  }

  function presetLuxuryVilla() {
    setForm({
      area: 4200,
      bedrooms: 5,
      bathrooms: 4,
      stories: 2,
      parking: 3,
      furnishing_numeric: 2,
      luxury_score: 0.85,
      mainroad: true,
      guestroom: true,
      basement: true,
      hotwaterheating: true,
      airconditioning: true,
      prefarea: true,
    })
    setResult(null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    // Build payload without ''
    const data: Record<string, number | boolean> = {}
    for (const k of Object.keys(form) as Array<keyof FormState>) {
      const v = form[k]
      if (v !== '') data[k] = v
    }

    try {
      const res = await fetch(`${apiBase}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, return_features: true }),
      })
      if (!res.ok) {
        const detail = (await res.json().catch(
          () => ({}),
        )) as { detail?: ErrorDetail }
        const baseMsg =
          typeof detail.detail === 'string'
            ? detail.detail
            : (detail.detail?.error as string | undefined) || res.statusText
        const missing =
          typeof detail.detail === 'string'
            ? undefined
            : detail.detail?.missing_keys
        setError(
          missing?.length
            ? `${String(baseMsg)} – missing: ${missing.join(', ')}`
            : String(baseMsg),
        )
        setLoading(false)
        return
      }
      const json = (await res.json()) as PredictResponse
      setResult(json)
    } catch (err: unknown) {
      const m =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message)
          : 'Network error'
      setError(m)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-white text-gray-900">
      {/* HERO */}
      <section className="relative h-[44vh] w-full overflow-hidden rounded-b-[28px]">
        <Image
          src={HERO_IMAGE_SRC}
          alt="Contemporary Indian home exterior"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Frosted overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/30 to-white/80 backdrop-blur-[2px]" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/70 px-3 py-1 text-[11px] uppercase tracking-wide text-gray-700 shadow">
                India • Square Feet • Million INR
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                India Housing Price Estimator
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Enter home details in <strong>square feet (sq ft)</strong>. Prices are shown in{' '}
                <strong>million INR</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN GRID */}
      <main className="mx-auto -mt-10 max-w-6xl p-6">
        <div className="grid gap-6 md:grid-cols-5">
          {/* FORM CARD */}
          <form
            onSubmit={handleSubmit}
            className="md:col-span-3 rounded-3xl border border-black/5 bg-white/80 p-6 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.15)] backdrop-blur"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <SectionTitle>Home Details</SectionTitle>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={presetSuburban}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                >
                  Preset: Suburban
                </button>
                <button
                  type="button"
                  onClick={presetLuxuryVilla}
                  className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white shadow transition hover:opacity-90"
                >
                  Preset: Luxury Villa
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <NumberInput
                label="Living Area"
                hint="Gross internal area"
                value={form.area}
                onChange={(v) => setField('area', v)}
                placeholder="e.g., 2800"
                step={1}
                min={0}
                unit="sq ft"
              />
              <NumberInput
                label="Bedrooms"
                value={form.bedrooms}
                onChange={(v) => setField('bedrooms', v)}
                placeholder="e.g., 3"
                step={1}
                min={0}
                unit="#"
              />
              <NumberInput
                label="Bathrooms"
                value={form.bathrooms}
                onChange={(v) => setField('bathrooms', v)}
                placeholder="e.g., 2"
                step={1}
                min={0}
                unit="#"
              />
              <NumberInput
                label="Stories"
                value={form.stories}
                onChange={(v) => setField('stories', v)}
                placeholder="e.g., 2"
                step={1}
                min={0}
                unit="#"
              />
              <NumberInput
                label="Parking"
                hint="Dedicated spots"
                value={form.parking}
                onChange={(v) => setField('parking', v)}
                placeholder="e.g., 2"
                step={1}
                min={0}
                unit="spots"
              />
              <NumberInput
                label="Furnishing"
                hint="0 Unfurnished • 1 Semi • 2 Fully"
                value={form.furnishing_numeric}
                onChange={(v) => setField('furnishing_numeric', v)}
                placeholder="0 / 1 / 2"
                step={1}
                min={0}
              />
              <NumberInput
                label="Luxury Score"
                hint="0.00 – 1.00"
                value={form.luxury_score}
                onChange={(v) => setField('luxury_score', v)}
                placeholder="e.g., 0.50"
                step={0.01}
                min={0}
              />
            </div>

            <div className="mt-6 mb-1">
              <SectionTitle>Amenities</SectionTitle>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Toggle
                label="On Main Road"
                checked={form.mainroad}
                onChange={(v) => setField('mainroad', v)}
              />
              <Toggle
                label="Guest Room"
                checked={form.guestroom}
                onChange={(v) => setField('guestroom', v)}
              />
              <Toggle
                label="Basement"
                checked={form.basement}
                onChange={(v) => setField('basement', v)}
              />
              <Toggle
                label="Hot Water Heating"
                checked={form.hotwaterheating}
                onChange={(v) => setField('hotwaterheating', v)}
              />
              <Toggle
                label="Air Conditioning"
                checked={form.airconditioning}
                onChange={(v) => setField('airconditioning', v)}
              />
              <Toggle
                label="Preferred Area"
                checked={form.prefarea}
                onChange={(v) => setField('prefarea', v)}
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'inline-flex items-center justify-center rounded-2xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow transition',
                  loading && 'opacity-80',
                )}
              >
                {loading ? 'Estimating…' : 'Estimate Price'}
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </form>

          {/* RESULT CARD */}
          <aside className="md:col-span-2 flex flex-col gap-4">
            <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.15)] backdrop-blur">
              <SectionTitle>Estimated Value</SectionTitle>
              <p className="mt-1 text-sm text-gray-600">
                Predicted Price <span className="text-gray-500">()</span>
              </p>

              <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-6 text-center">
                {result ? (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">
                      PREDICTED PRICE
                    </div>
                    <div className="mt-2 text-4xl font-extrabold tracking-tight">
                      {/* Raw rupees with all zeros shown */}
                      {'₹ ' + rupeeFmt.format(result.prediction)}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-400">—</div>
                )}
              </div>
              {result?.used_features && (
                <details className="mt-4 rounded-2xl border border-gray-100 bg-white p-3 text-sm open:shadow-sm">
                  <summary className="cursor-pointer font-medium text-gray-900">
                    View feature vector sent to model
                  </summary>
                  <div className="mt-3 max-h-80 overflow-auto rounded-xl bg-gray-50 p-3 text-xs">
                    <table className="w-full table-fixed border-separate border-spacing-y-1">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th className="w-2/5">Feature</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(result.used_features).map(([k, v]) => (
                          <tr key={k}>
                            <td className="truncate align-top font-medium text-gray-900">
                              {k}
                            </td>
                            <td className="align-top text-gray-700">
                              {typeof v === 'number' ? v : String(v)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="mx-auto max-w-6xl p-6 text-center text-xs text-gray-500">
        Minimal • Futuristic • India Market
      </footer>
    </div>
  )
}
