import { useEffect, useState } from 'react'
import { useReceiptStore } from '@shared/stores/receiptStore'
import type { EditableItem, Person } from '@shared/types'
import type { ItemsSubPhase, SimpleWizardStep } from '@pages/types'
import { loadSimpleWizardState, saveSimpleWizardState } from '@pages/logic/persistence'
import { clampActiveItemIndex, resolveWizardState } from '@pages/logic/wizardState'
import { isStepValid } from '@pages/logic/wizardValidation'

export function useSimpleWizard(
  items: EditableItem[],
  people: Person[],
  normalizeItemsForSimpleMode: () => void,
) {
  const geminiApiKeyInput = useReceiptStore((state) => state.geminiApiKeyInput)
  const setShowApiKeyModal = useReceiptStore((state) => state.setShowApiKeyModal)
  const addReceipt = useReceiptStore((state) => state.addReceipt)

  const [initialWizardState] = useState(() => loadSimpleWizardState())
  const [activeStepState, setActiveStep] = useState<SimpleWizardStep>(
    initialWizardState?.step ?? 'people',
  )
  const [itemsSubPhaseState, setItemsSubPhase] = useState<ItemsSubPhase>(
    initialWizardState?.itemsSubPhase ?? 'assign',
  )
  const [activeItemIndex, setActiveItemIndex] = useState(
    initialWizardState?.activeItemIndex ?? 0,
  )

  const { activeStep, itemsSubPhase } = resolveWizardState(
    activeStepState,
    itemsSubPhaseState,
    items,
    people,
  )
  const safeActiveItemIndex = clampActiveItemIndex(activeItemIndex, items.length)

  useEffect(() => {
    saveSimpleWizardState({
      step: activeStep,
      itemsSubPhase,
      activeItemIndex: safeActiveItemIndex,
    })
  }, [activeStep, itemsSubPhase, safeActiveItemIndex])

  const canContinue =
    activeStep === 'items'
      ? itemsSubPhase === 'review' && isStepValid('items', { items, people })
      : isStepValid(activeStep, { items, people })

  const handleNext = () => {
    if (activeStep === 'people') {
      if (!isStepValid('people', { items, people })) return
      setActiveStep('receipt')
      if (!geminiApiKeyInput.trim()) setShowApiKeyModal(true)
      return
    }

    if (activeStep === 'receipt') {
      if (!isStepValid('receipt', { items, people })) return
      normalizeItemsForSimpleMode()
      setItemsSubPhase('assign')
      setActiveItemIndex(0)
      setActiveStep('items')
      return
    }

    if (activeStep === 'items') {
      if (itemsSubPhase === 'assign') {
        if (safeActiveItemIndex < items.length - 1) {
          setActiveItemIndex(safeActiveItemIndex + 1)
        } else {
          setItemsSubPhase('review')
        }
        return
      }
      if (!isStepValid('items', { items, people })) return
      setActiveStep('final')
    }
  }

  const handleBack = () => {
    if (activeStep === 'final') {
      setActiveStep('items')
      setItemsSubPhase('review')
      return
    }

    if (activeStep === 'items') {
      if (itemsSubPhase === 'review') {
        setItemsSubPhase('assign')
        return
      }
      setActiveStep('receipt')
      return
    }

    if (activeStep === 'receipt') {
      setActiveStep('people')
    }
  }

  const handleAddReceipt = () => {
    addReceipt()
    setItemsSubPhase('assign')
    setActiveItemIndex(0)
    setActiveStep('receipt')
    if (!geminiApiKeyInput.trim()) setShowApiKeyModal(true)
  }

  return {
    activeStep,
    itemsSubPhase,
    safeActiveItemIndex,
    setActiveItemIndex: (index: number) => setActiveItemIndex(index),
    setItemsSubPhase: (phase: ItemsSubPhase) => setItemsSubPhase(phase),
    canContinue,
    handleNext,
    handleBack,
    handleAddReceipt,
  }
}
