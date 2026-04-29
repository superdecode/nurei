'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Undo, Redo, Minus,
} from 'lucide-react'

const COLORS = [
  '#111827', '#6B7280', '#EF4444', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#EC4899', '#78350F',
]

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
}

export function RichTextEditor({ value, onChange, placeholder, className, minHeight = '120px' }: RichTextEditorProps) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, code: false }),
      TextStyle,
      Color,
      Underline,
      Placeholder.configure({ placeholder: placeholder ?? 'Descripción del producto…' }),
    ],
    content: value || '',
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none focus:outline-none px-3 py-2.5 text-gray-800 leading-relaxed' },
    },
    onUpdate({ editor }) {
      const html = editor.getHTML()
      onChangeRef.current(html === '<p></p>' ? '' : html)
    },
  })

  // Sync external value changes (e.g. product load)
  const prevValue = useRef(value)
  useEffect(() => {
    if (!editor) return
    if (value !== prevValue.current && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
    prevValue.current = value
  }, [value, editor])

  if (!editor) return null

  const ToolBtn = ({
    onClick, active, title, children,
  }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={cn(
        'h-7 w-7 rounded-md flex items-center justify-center transition-colors text-gray-500',
        active ? 'bg-primary-cyan/20 text-primary-dark' : 'hover:bg-gray-100 hover:text-gray-800',
      )}
    >
      {children}
    </button>
  )

  return (
    <div className={cn('rounded-xl border border-input bg-white overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50/60">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrita">
          <Bold className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Cursiva">
          <Italic className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Subrayado">
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolBtn>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista">
          <List className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Separador">
          <Minus className="w-3.5 h-3.5" />
        </ToolBtn>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Color swatches */}
        <div className="flex items-center gap-0.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(c).run() }}
              title={c}
              className={cn(
                'w-4.5 h-4.5 rounded-full border-2 transition-transform hover:scale-110',
                editor.isActive('textStyle', { color: c }) ? 'border-primary-dark scale-110' : 'border-transparent',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetColor().run() }}
            title="Sin color"
            className="w-4.5 h-4.5 rounded-full border-2 border-gray-300 bg-gradient-to-br from-gray-200 to-white text-[8px] flex items-center justify-center hover:scale-110 transition-transform"
          >✕</button>
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Deshacer">
            <Undo className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Rehacer">
            <Redo className="w-3.5 h-3.5" />
          </ToolBtn>
        </div>
      </div>

      {/* Editor area */}
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
