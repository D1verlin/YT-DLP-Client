import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import useStore from '../store/useStore'

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder,
  icon: Icon,
  className = ''
}) {
  const lang = useStore((s) => s.language)
  const defaultPlaceholder = lang === 'en' ? 'Select...' : 'Выберите...'
  const activePlaceholder = placeholder || defaultPlaceholder
  const [isOpen, setIsOpen] = useState(false)
  const [placement, setPlacement] = useState('bottom')
  const [maxHeight, setMaxHeight] = useState(210)
  const containerRef = useRef(null)

  // Normalize options array: handles both strings and objects { value, label }
  const formattedOptions = options.map((opt) =>
    typeof opt === 'object' && opt !== null
      ? opt
      : { value: opt, label: String(opt) }
  )

  const selectedOption = formattedOptions.find((opt) => opt.value === value)

  // Smart placement detection: flips to 'top' if near screen bottom
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const estimatedHeight = Math.min(220, formattedOptions.length * 36 + 12)

      if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
        setPlacement('top')
        setMaxHeight(Math.min(220, Math.max(100, spaceAbove - 24)))
      } else {
        setPlacement('bottom')
        setMaxHeight(Math.min(220, Math.max(100, spaceBelow - 24)))
      }
    }
  }, [isOpen, formattedOptions.length])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Handle keyboard events
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsOpen((prev) => !prev)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
      } else {
        const currIndex = formattedOptions.findIndex((o) => o.value === value)
        if (currIndex < formattedOptions.length - 1) {
          onChange(formattedOptions[currIndex + 1].value)
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (isOpen) {
        const currIndex = formattedOptions.findIndex((o) => o.value === value)
        if (currIndex > 0) {
          onChange(formattedOptions[currIndex - 1].value)
        }
      }
    }
  }

  const handleSelect = (val) => {
    onChange(val)
    setIsOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${isOpen ? 'is-open' : ''} ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Trigger Button */}
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="custom-select-value">
          {Icon && <Icon size={14} className="custom-select-icon" />}
          <span className="custom-select-label">
            {selectedOption ? selectedOption.label : activePlaceholder}
          </span>
        </div>
        <ChevronDown
          size={15}
          className={`custom-select-chevron ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Floating Dropdown Popup with Auto-Placement */}
      {isOpen && (
        <div className={`custom-select-dropdown placement-${placement}`}>
          <div
            className="custom-select-list"
            style={{ maxHeight: `${maxHeight}px` }}
          >
            {formattedOptions.map((option) => {
              const isSelected = option.value === value
              return (
                <div
                  key={String(option.value)}
                  className={`custom-select-item ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                >
                  <span className="custom-select-item-label">{option.label}</span>
                  {isSelected && (
                    <Check size={14} className="custom-select-check" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
