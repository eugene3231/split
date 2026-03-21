import { useEffect, useLayoutEffect } from 'react'
import { useShallow } from 'zustand/shallow'
import { useDraftPersistence } from '@shared/hooks/useDraftPersistence'
import { useReceiptStore } from '@shared/stores/receiptStore'
import { useLoadingTicker } from '@features/receipt-scanner'

export function useReceiptSplitterController() {
  const {
    uxMode,
    setUxMode,
    isScanning,
    advanceLoadingMessage,
    initialized,
    people,
    receipts,
    activeReceiptId,
    initialize,
    reset,
    normalizeItemsForSimpleMode,
  } = useReceiptStore(
    useShallow((state) => ({
      uxMode: state.uxMode,
      setUxMode: state.setUxMode,
      isScanning: Object.values(state.scanStateByReceipt).some((s) => s.isScanning),
      advanceLoadingMessage: state.advanceLoadingMessage,
      initialized: state.initialized,
      people: state.people,
      receipts: state.receipts,
      activeReceiptId: state.activeReceiptId,
      initialize: state.initialize,
      reset: state.reset,
      normalizeItemsForSimpleMode: state.normalizeItemsForSimpleMode,
    })),
  )

  useLayoutEffect(() => {
    if (!initialized) {
      initialize(uxMode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  useDraftPersistence({ initialized, people, receipts, activeReceiptId })
  useLoadingTicker({ isActive: isScanning, onTick: advanceLoadingMessage })

  const handleUxModeChange = (nextMode: 'simple' | 'advanced') => {
    if (nextMode === uxMode) {
      return
    }

    if (nextMode === 'simple') {
      normalizeItemsForSimpleMode()
    }

    setUxMode(nextMode)
  }

  return {
    uxMode,
    handleUxModeChange,
  }
}
