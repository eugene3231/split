import type { FormEvent, ReactNode } from 'react'
import type { ChargeState, Person } from '@shared/types'
import { useReceiptStore } from '@shared/stores/receiptStore'
import { GlobalChargesSection } from '@features/split-config/components/GlobalChargesSection'
import { PeopleSetupSection } from '@features/split-config/components/PeopleSetupSection'

type SetupPanelProps = {
  people: Person[]
  onAddPeople: (rawInput: string) => void
  onRemovePerson: (personId: string) => void
  discount: ChargeState
  onDiscountChange: (next: ChargeState) => void
  serviceCharge: ChargeState
  onServiceChargeChange: (next: ChargeState) => void
  gst: ChargeState
  onGstChange: (next: ChargeState) => void
  receiptTotalInput: string
  onReceiptTotalInputChange: (value: string) => void
  importSection?: ReactNode
}

export function SetupPanel({
  people,
  onAddPeople,
  onRemovePerson,
  discount,
  onDiscountChange,
  serviceCharge,
  onServiceChargeChange,
  gst,
  onGstChange,
  receiptTotalInput,
  onReceiptTotalInputChange,
  importSection,
}: SetupPanelProps) {
  const peopleInput = useReceiptStore((state) => state.peopleInput)
  const setPeopleInput = useReceiptStore((state) => state.setPeopleInput)

  const handlePeopleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onAddPeople(peopleInput)
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h2 className="text-lg font-semibold">Configure</h2>

      <PeopleSetupSection
        peopleInput={peopleInput}
        onPeopleInputChange={setPeopleInput}
        onPeopleSubmit={handlePeopleSubmit}
        people={people}
        onRemovePerson={onRemovePerson}
      />

      {importSection}

      <GlobalChargesSection
        discount={discount}
        onDiscountChange={onDiscountChange}
        serviceCharge={serviceCharge}
        onServiceChargeChange={onServiceChargeChange}
        gst={gst}
        onGstChange={onGstChange}
        receiptTotalInput={receiptTotalInput}
        onReceiptTotalInputChange={onReceiptTotalInputChange}
      />
    </section>
  )
}
