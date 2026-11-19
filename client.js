window.__ModuleLoader__.load({
  id: 'dsh-slipnote',
  factory(require) {
    'use strict'

    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef } = React

    const NS = 'dsh-slipnote'
    const API_ROOT = '/api/memo'
    const CACHE_KEY = 'dsh-slipnote.cache.v1'
    const CHANGE_EVENT = 'dsh-slipnote:changed'
    const savedMessageIds = new Set()

    const ZH = {
      nav: '拾笺',
      title: '拾笺',
      'message.saveToMemo': '添加到备忘录',
      'message.savingToMemo': '正在添加…',
      'message.savedToMemo': '已添加到备忘录',
      'message.saveFailed': '添加失败',
      'tab.notes': '备忘录',
      'tab.plans': '计划书',
      'action.newNote': '新建',
      'action.newPlan': '新建计划',
      'action.save': '保存',
      'action.delete': '删除',
      'action.cancel': '取消',
      'action.close': '关闭',
      'action.refresh': '刷新',
      'action.pin': '置顶',
      'action.unpin': '取消置顶',
      'action.archive': '归档',
      'action.unarchive': '取消归档',
      'action.insert': '送入输入框',
      'action.jump': '跳回会话',
      'action.exportJson': '导出 JSON',
      'action.exportMd': '导出 Markdown',
      'action.import': '导入 JSON',
      'action.snapshot': '存消息快照',
      'action.selection': '存选中文字',
      'action.addImage': '添加图片',
      'action.addingImage': '正在处理图片…',
      'action.addStage': '添加阶段',
      'action.addStep': '添加步骤',
      'action.deliver': '投递为新对话',
      'action.remove': '移除',
      'action.moveUp': '上移',
      'action.moveDown': '下移',
      'search.placeholder': '搜索标题、内容、图片名或标签…',
      'filter.tags': '全部标签',
      'filter.archived': '含归档',
      'empty.notes': '还没有备忘录。新建一条，或把当前会话的消息存进来。',
      'empty.plans': '还没有计划。新建一份，从阶段和步骤开始。',
      'empty.selection': '没有选中文字',
      'editor.title': '标题',
      'editor.content': '内容',
      'editor.tags': '标签（逗号分隔）',
      'editor.images': '图片',
      'image.empty': '还没有图片，可以点击“添加图片”、粘贴或拖入。',
      'image.remove': '移除图片',
      'image.tooLarge': '图片太大，请换一张较小的图片。',
      'image.failed': '图片读取失败。',
      'note.image': '图片备忘录',
      'note.selection': '选中文字',
      'editor.note': '备注',
      'editor.planTitle': '计划标题',
      'source.manual': '手写',
      'source.selection': '选中文字',
      'source.composer': '输入框',
      'source.snapshot': '消息快照',
      'role.user': '用户',
      'role.assistant': '助手',
      'status.todo': '未开始',
      'status.doing': '进行中',
      'status.done': '完成',
      'status.hold': '搁置',
      'progress': '进度',
      'snapshot.title': '选择要保存的消息',
      'snapshot.session': '会话',
      'snapshot.loading': '正在读取消息…',
      'snapshot.empty': '这个会话还没有可保存的消息。',
      'snapshot.save': '保存到备忘录',
      'storage.local': '宿主暂不可用，当前使用 localStorage 缓存；恢复后请重新打开面板。',
      'storage.readonly': '数据版本高于插件，当前为只读。',
      'storage.warnings': '存储提示',
      'toast.saved': '已保存',
      'toast.deleted': '已删除',
      'toast.inserted': '已送入输入框',
      'toast.copied': '当前没有打开的会话，已复制到剪贴板',
      'toast.noSession': '没有可用的会话，也没有剪贴板权限',
      'toast.insertFailed': '送入输入框失败，请先打开一个会话后重试',
      'toast.imageOnly': '这是一条纯图片备忘录。先补一句文字说明，再送入输入框。',
      'toast.exported': '已导出',
      'toast.imported': '已导入',
      'toast.failed': '操作失败',
      'confirm.deleteNote': '确定删除这条备忘录吗？',
      'confirm.deletePlan': '确定删除这份计划吗？',
      'confirm.importReplace': '确定用导入数据替换现有数据吗？取消则合并。',
      'loading': '加载中…',
      'storage.disk': '已落盘',
      'stage.new': '新阶段',
      'step.new': '新步骤',
      'step.doneAt': '完成时间',
      'plan.archived': '已归档',
      'note.pinned': '已置顶',
      'note.archived': '已归档',
      'import.onlineOnly': '离线缓存模式下不能导入，请恢复宿主后重试。',
      'deliver.prompt': '请根据以下计划继续推进。\n\n计划：{plan}\n阶段：{stage}\n步骤：{step}\n状态：{status}\n备注：{note}\n\n请先确认目标、约束和已有进展，再开始执行；完成后说明改动与验证结果。',
    }

    const EN = {
      nav: 'Shijian',
      title: 'Shijian',
      'message.saveToMemo': 'Add to memo',
      'message.savingToMemo': 'Adding…',
      'message.savedToMemo': 'Added to memo',
      'message.saveFailed': 'Could not add',
      'tab.notes': 'Memo',
      'tab.plans': 'Plans',
      'action.newNote': 'New',
      'action.newPlan': 'New plan',
      'action.save': 'Save',
      'action.delete': 'Delete',
      'action.cancel': 'Cancel',
      'action.close': 'Close',
      'action.refresh': 'Refresh',
      'action.pin': 'Pin',
      'action.unpin': 'Unpin',
      'action.archive': 'Archive',
      'action.unarchive': 'Unarchive',
      'action.insert': 'Insert into composer',
      'action.jump': 'Open session',
      'action.exportJson': 'Export JSON',
      'action.exportMd': 'Export Markdown',
      'action.import': 'Import JSON',
      'action.snapshot': 'Save message',
      'action.selection': 'Save selection',
      'action.addImage': 'Add image',
      'action.addingImage': 'Processing image…',
      'action.addStage': 'Add stage',
      'action.addStep': 'Add step',
      'action.deliver': 'Send to new chat',
      'action.remove': 'Remove',
      'action.moveUp': 'Move up',
      'action.moveDown': 'Move down',
      'search.placeholder': 'Search title, content, or tags…',
      'filter.tags': 'All tags',
      'filter.archived': 'Include archived',
      'empty.notes': 'No memos yet. Create one, or save a message from this conversation.',
      'empty.plans': 'No plans yet. Create one with stages and steps.',
      'empty.selection': 'No text selected',
      'editor.title': 'Title',
      'editor.content': 'Content',
      'editor.tags': 'Tags (comma separated)',
      'editor.images': 'Images',
      'image.empty': 'No images yet. Add, paste, or drop an image here.',
      'image.remove': 'Remove image',
      'image.tooLarge': 'That image is too large. Try a smaller one.',
      'image.failed': 'Could not read that image.',
      'note.image': 'Image memo',
      'note.selection': 'Selection',
      'editor.note': 'Note',
      'editor.planTitle': 'Plan title',
      'source.manual': 'Manual',
      'source.selection': 'Selection',
      'source.composer': 'Composer',
      'source.snapshot': 'Message snapshot',
      'role.user': 'User',
      'role.assistant': 'Assistant',
      'status.todo': 'Todo',
      'status.doing': 'Doing',
      'status.done': 'Done',
      'status.hold': 'On hold',
      'progress': 'Progress',
      'snapshot.title': 'Choose a message to save',
      'snapshot.session': 'Session',
      'snapshot.loading': 'Reading messages…',
      'snapshot.empty': 'This session has no messages to save yet.',
      'snapshot.save': 'Save memo',
      'storage.local': 'Host unavailable; using localStorage cache. Reopen the panel after it recovers.',
      'storage.readonly': 'Data schema is newer than this plugin; read-only.',
      'storage.warnings': 'Storage notices',
      'toast.saved': 'Saved',
      'toast.deleted': 'Deleted',
      'toast.inserted': 'Inserted into the composer',
      'toast.copied': 'No open session; copied to the clipboard',
      'toast.noSession': 'No session and no clipboard permission',
      'toast.insertFailed': 'Could not insert into the composer. Open a session and retry.',
      'toast.imageOnly': 'This is an image-only memo. Add a line of text before inserting it.',
      'toast.exported': 'Exported',
      'toast.imported': 'Imported',
      'toast.failed': 'Operation failed',
      'confirm.deleteNote': 'Delete this memo?',
      'confirm.deletePlan': 'Delete this plan?',
      'confirm.importReplace': 'Replace existing data with the import? Cancel to merge.',
      'loading': 'Loading…',
      'storage.disk': 'On disk',
      'stage.new': 'New stage',
      'step.new': 'New step',
      'step.doneAt': 'Completed at',
      'plan.archived': 'Archived',
      'note.pinned': 'Pinned',
      'note.archived': 'Archived',
      'import.onlineOnly': 'Import needs the host; retry after it recovers.',
      'deliver.prompt': 'Continue the work described by this plan.\n\nPlan: {plan}\nStage: {stage}\nStep: {step}\nStatus: {status}\nNote: {note}\n\nConfirm the goal, constraints, and existing progress before starting; finish by describing the changes and verification.',
    }

    // ---------- generic helpers ----------

    function cx(...values) {
      return values.filter(Boolean).join(' ')
    }

    function uid(prefix) {
      try {
        return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`
      } catch {
        return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
      }
    }

    function firstLine(value) {
      return (
        String(value ?? '')
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean) ?? ''
      )
    }

    function parseTags(text) {
      return [
        ...new Set(
          String(text ?? '')
            .split(/[,，\n]/)
            .map((tag) => tag.trim().replace(/^#+/, '').toLowerCase())
            .filter(Boolean),
        ),
      ]
    }

    function formatTime(value) {
      if (!value) return ''
      try {
        return new Date(value).toLocaleString()
      } catch {
        return ''
      }
    }

    function contentToText(content) {
      if (typeof content === 'string') return content
      if (Array.isArray(content)) return content.map(contentToText).filter(Boolean).join('\n')
      if (content && typeof content === 'object') {
        // Assistant turns may contain reasoning, tool calls, images and other
        // non-text blocks. Notes should only keep what the user can read.
        if (typeof content.type === 'string' && content.type !== 'text') return ''
        if (typeof content.text === 'string') return content.text
        if (content.content !== undefined) return contentToText(content.content)
      }
      return ''
    }

    function titleFromContent(value, options = {}) {
      const lines = String(value ?? '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) =>
          line
            .replace(/^```.*$/, '')
            .replace(/^[\s>#>*_`~+\-]+/, '')
            .replace(/[*_`~]+/g, '')
            .replace(/^\[(.*?)\]\([^)]*\)$/, '$1')
            .replace(/^(以下是|下面是|这是)(?:关于)?[，,。:：]?\s*/, '')
            .replace(/^(好的|好|可以|没问题|收到|当然|ok|sure)[，,。.!！:：]\s*/i, '')
            .trim(),
        )
        .filter(Boolean)
      const generic =
        /^(好的|好|可以|没问题|已完成|完成了|以下是|这是|当然|ok|sure)[，,。.!！:：\s]*$/i
      const first = lines.find((line) => !generic.test(line)) ?? lines[0]
      if (!first) {
        if (options.hasImages) return options.imageFallback ?? '图片备忘录'
        return options.fallback ?? ''
      }
      if (first.length <= 36) return first
      const windowText = first.slice(0, 36)
      const punct = Math.max(
        windowText.lastIndexOf('。'),
        windowText.lastIndexOf('！'),
        windowText.lastIndexOf('？'),
        windowText.lastIndexOf('；'),
        windowText.lastIndexOf('，'),
        windowText.lastIndexOf('.'),
        windowText.lastIndexOf('!'),
        windowText.lastIndexOf('?'),
        windowText.lastIndexOf(','),
      )
      const end = punct >= 10 ? punct : 36
      return `${first.slice(0, end).trimEnd()}…`
    }

    function messageText(message) {
      if (!message) return ''
      return contentToText(message.content)
    }

    function noteFromMessage(message, sessionId, sessionTitle) {
      const content = messageText(message)
      const role = message?.role === 'user' ? 'user' : 'assistant'
      const fallback = sessionTitle ? `${role === 'user' ? '我' : '助手'} · ${sessionTitle}` : '对话快照'
      return {
        title: titleFromContent(content, { fallback }),
        content,
        source: 'snapshot',
        sessionId: sessionId ?? null,
        sessionTitle: sessionTitle ?? null,
        messageIndex: Number.isInteger(message?.index) ? message.index : null,
        messageSeq: Number.isInteger(message?.seq) ? message.seq : null,
        messageRole: message?.role === 'user' || message?.role === 'assistant' ? message.role : null,
        messageTime: Number.isInteger(message?.time) ? message.time : null,
      }
    }

    function notifyMemoChanged() {
      try {
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
      } catch {
        /* non-browser test environment */
      }
    }

    /**
     * One small action in the assistant message footer. It deliberately does
     * not depend on the panel being open: the note is written through the same
     * /api/memo surface, then the panel refreshes through CHANGE_EVENT.
     */
    function AssistantMemoAction({ memoCtx, messageId, sessionId, t }) {
      const [state, setState] = useState(savedMessageIds.has(messageId) ? 'saved' : 'idle')
      const [hover, setHover] = useState(false)
      const timer = useRef(null)
      const tr = (key) => (typeof t === 'function' ? t(key) : key)

      useEffect(
        () => () => {
          if (timer.current !== null) clearTimeout(timer.current)
        },
        [],
      )

      function settle(next) {
        setState(next)
        if (timer.current !== null) clearTimeout(timer.current)
        timer.current = setTimeout(() => setState('idle'), 2200)
      }

      async function save(event) {
        event.preventDefault()
        event.stopPropagation()
        if (state === 'busy' || savedMessageIds.has(messageId)) return
        if (!memoCtx || !sessionId || !messageId) {
          settle('error')
          return
        }
        setState('busy')
        try {
          const row = sessionRows(memoCtx).find((item) => item?.id === sessionId)
          const messages = await loadMessages(memoCtx, sessionId)
          const message = messages.find((item) => item.messageId === messageId)
          if (!message || message.content.trim() === '') {
            settle('error')
            return
          }
          const input = noteFromMessage(message, sessionId, row?.title ?? null)
          try {
            await request('/notes', { method: 'POST', body: input })
          } catch {
            // Offline / host-unavailable path: keep the note in the cache so
            // the panel can still show it and a later save can reconcile.
            localCreateNote(input)
          }
          savedMessageIds.add(messageId)
          settle('saved')
          notifyMemoChanged()
        } catch {
          settle('error')
        }
      }

      const label =
        state === 'busy'
          ? tr('message.savingToMemo')
          : state === 'saved'
            ? tr('message.savedToMemo')
            : state === 'error'
              ? tr('message.saveFailed')
              : tr('message.saveToMemo')

      const icon =
        state === 'busy'
          ? h('span', { style: { fontSize: '11px', lineHeight: 1 } }, '…')
          : state === 'saved'
            ? h(
                'svg',
                {
                  width: 14,
                  height: 14,
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: 2,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  'aria-hidden': true,
                },
                h('path', { d: 'M5 12.5l4.5 4.5L19 7' }),
              )
            : state === 'error'
              ? h('span', { style: { fontSize: '12px', fontWeight: 700, lineHeight: 1 } }, '!')
              : h(
                  'svg',
                  {
                    width: 14,
                    height: 14,
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    strokeWidth: 1.7,
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                    'aria-hidden': true,
                  },
                  h('path', { d: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z' }),
                  h('path', { d: 'M12 8v6M9 11h6' }),
                )

      return h(
        'button',
        {
          type: 'button',
          className: 'dm-msg-action',
          'aria-label': label,
          'aria-busy': state === 'busy' ? 'true' : undefined,
          title: label,
          disabled: state === 'busy',
          onClick: save,
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            padding: 0,
            margin: '0 2px',
            border: 0,
            borderRadius: '6px',
            background: hover ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
            color:
              state === 'saved'
                ? 'var(--dsw-alias-state-success-primary)'
                : state === 'error'
                  ? 'var(--dsw-alias-state-error-primary)'
                  : 'var(--dsw-alias-label-secondary)',
            cursor: state === 'busy' ? 'default' : 'pointer',
            opacity: state === 'busy' ? 0.6 : 1,
            verticalAlign: 'middle',
          },
        },
        icon,
      )
    }

    function defaultPrefs() {
      return {
        schemaVersion: 1,
        theme: 'auto',
        activeTab: 'notes',
        lastPlanId: null,
        lastNoteId: null,
      }
    }

    function emptyData() {
      return {
        notes: [],
        plans: [],
        prefs: defaultPrefs(),
        storage: { mode: 'local', readOnly: false, warnings: [], notesCount: 0, plansCount: 0 },
      }
    }

    function progressOf(plan) {
      let total = 0
      let done = 0
      for (const stage of plan?.stages ?? []) {
        for (const step of stage.steps ?? []) {
          total += 1
          if (step.status === 'done') done += 1
        }
      }
      return { total, done, percent: total === 0 ? 0 : Math.round((done * 100) / total) }
    }

    function readCache() {
      try {
        const text = localStorage.getItem(CACHE_KEY)
        if (!text) return null
        const parsed = JSON.parse(text)
        if (!parsed || typeof parsed !== 'object') return null
        return {
          notes: Array.isArray(parsed.notes) ? parsed.notes : [],
          plans: Array.isArray(parsed.plans) ? parsed.plans : [],
          prefs: { ...defaultPrefs(), ...(parsed.prefs ?? {}) },
          storage: {
            mode: 'local',
            readOnly: false,
            warnings: [],
            notesCount: Array.isArray(parsed.notes) ? parsed.notes.length : 0,
            plansCount: Array.isArray(parsed.plans) ? parsed.plans.length : 0,
          },
        }
      } catch {
        return null
      }
    }

    function writeCache(data) {
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ notes: data.notes ?? [], plans: data.plans ?? [], prefs: data.prefs ?? defaultPrefs() }),
        )
      } catch {
        /* localStorage unavailable; in-memory state still works */
      }
    }

    // ---------- HTTP + offline fallback ----------

    async function request(path, options = {}) {
      const response = await fetch(API_ROOT + path, {
        method: options.method ?? 'GET',
        headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      })
      let payload = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }
      if (!response.ok || !payload || payload.ok !== true) {
        const message = payload?.error?.message ?? `HTTP ${response.status}`
        const error = new Error(message)
        error.code = payload?.error?.code
        error.status = response.status
        throw error
      }
      return payload.data
    }

    let localData = readCache() ?? emptyData()

    function localCommit(next) {
      localData = next
      writeCache(next)
      return next
    }

    function localImages(value) {
      if (!Array.isArray(value)) return []
      return value
        .filter((image) => image && typeof image.dataUrl === 'string')
        .slice(0, MAX_IMAGES)
        .map((image) => ({
          id: typeof image.id === 'string' ? image.id : newImageId(),
          name: String(image.name ?? '图片').slice(0, 120),
          mime: String(image.mime ?? 'image/png'),
          dataUrl: image.dataUrl,
          width: Number.isInteger(image.width) ? image.width : 0,
          height: Number.isInteger(image.height) ? image.height : 0,
          size: Number.isInteger(image.size) ? image.size : 0,
        }))
    }

    function buildLocalNote(input, { regenerateId = true } = {}) {
      const now = Date.now()
      const content = String(input.content ?? '')
      const images = localImages(input.images)
      return {
        id: !regenerateId && typeof input.id === 'string' ? input.id : uid('n'),
        title:
          String(input.title ?? '').trim() ||
          titleFromContent(content, {
            hasImages: images.length > 0,
            fallback: '未命名备忘录',
          }),
        content,
        images,
        tags: Array.isArray(input.tags) ? parseTags(input.tags.join(',')) : [],
        source: ['manual', 'selection', 'composer', 'snapshot'].includes(input.source)
          ? input.source
          : 'manual',
        sessionId: input.sessionId ?? null,
        sessionTitle: input.sessionTitle ?? null,
        messageIndex: Number.isInteger(input.messageIndex) ? input.messageIndex : null,
        messageSeq: Number.isInteger(input.messageSeq) ? input.messageSeq : null,
        messageRole: input.messageRole === 'user' || input.messageRole === 'assistant' ? input.messageRole : null,
        messageTime: Number.isInteger(input.messageTime) ? input.messageTime : null,
        pinned: Boolean(input.pinned),
        archived: Boolean(input.archived),
        createdAt: Number.isInteger(input.createdAt) ? input.createdAt : now,
        updatedAt: now,
      }
    }

    function localCreateNote(input) {
      const note = buildLocalNote(input)
      localCommit({ ...localData, notes: [note, ...localData.notes] })
      return note
    }

    function localUpdateNote(id, patch) {
      let updated = null
      const notes = localData.notes.map((note) => {
        if (note.id !== id) return note
        const images =
          patch.images !== undefined ? localImages(patch.images) : note.images ?? []
        updated = {
          ...note,
          ...patch,
          images,
          title:
            String(patch.title ?? note.title ?? '').trim() ||
            titleFromContent(String(patch.content ?? note.content ?? ''), {
              hasImages: images.length > 0,
              fallback: '未命名备忘录',
            }),
          tags: patch.tags !== undefined ? parseTags(patch.tags.join(',')) : note.tags,
          updatedAt: Date.now(),
        }
        return updated
      })
      if (updated) localCommit({ ...localData, notes })
      return updated
    }

    function localDeleteNote(id) {
      localCommit({ ...localData, notes: localData.notes.filter((note) => note.id !== id) })
    }

    function localStage(title, order) {
      return { id: uid('st'), title, order, steps: [] }
    }

    function localPlan(input, options = {}) {
      const {
        allowEmpty = false,
        regenerateIds = true,
        preserveTimestamps = false,
      } = options
      const now = Date.now()
      const rawStages = Array.isArray(input.stages) ? input.stages : []
      const stages = rawStages.length > 0 || allowEmpty ? rawStages : [localStage('阶段一', 0)]
      return {
        id: !regenerateIds && typeof input.id === 'string' ? input.id : uid('p'),
        title: String(input.title ?? '').trim() || '新计划',
        archived: Boolean(input.archived),
        createdAt:
          preserveTimestamps && Number.isInteger(input.createdAt) ? input.createdAt : now,
        updatedAt: now,
        stages: stages.map((stage, stageIndex) => ({
          id: !regenerateIds && typeof stage.id === 'string' ? stage.id : uid('st'),
          title: String(stage.title ?? ''),
          order: stageIndex,
          steps: (Array.isArray(stage.steps) ? stage.steps : []).map((step, stepIndex) => ({
            id: !regenerateIds && typeof step.id === 'string' ? step.id : uid('sp'),
            text: String(step.text ?? ''),
            status: ['todo', 'doing', 'done', 'hold'].includes(step.status) ? step.status : 'todo',
            note: String(step.note ?? ''),
            order: stepIndex,
            doneAt: step.status === 'done' ? step.doneAt ?? now : null,
          })),
        })),
      }
    }

    function localCreatePlan(input) {
      const plan = localPlan(input)
      localCommit({ ...localData, plans: [plan, ...localData.plans] })
      return plan
    }

    function localUpdatePlan(id, patch) {
      let updated = null
      const plans = localData.plans.map((plan) => {
        if (plan.id !== id) return plan
        updated = localPlan({ ...plan, ...patch }, { allowEmpty: true, regenerateIds: false })
        updated.id = plan.id
        updated.createdAt = plan.createdAt
        updated.updatedAt = Date.now()
        return updated
      })
      if (updated) localCommit({ ...localData, plans })
      return updated
    }

    function localDeletePlan(id) {
      localCommit({ ...localData, plans: localData.plans.filter((plan) => plan.id !== id) })
    }

    function localSetPrefs(patch) {
      const prefs = { ...localData.prefs, ...patch }
      localCommit({ ...localData, prefs })
      return prefs
    }

    function localImportData(mode, payload) {
      if (mode !== 'merge' && mode !== 'replace') {
        throw new Error('mode 必须是 merge 或 replace')
      }
      const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}
      const rawNotes = Array.isArray(source.notes) ? source.notes : []
      const rawPlans = Array.isArray(source.plans) ? source.plans : []
      const regenerateIds = mode === 'merge'
      const importedNotes = rawNotes.map((note) =>
        buildLocalNote(note && typeof note === 'object' ? note : {}, { regenerateId: regenerateIds }),
      )
      const importedPlans = rawPlans.map((plan) =>
        localPlan(plan && typeof plan === 'object' ? plan : {}, {
          allowEmpty: true,
          regenerateIds,
          preserveTimestamps: true,
        }),
      )
      if (mode === 'replace') {
        const next = { ...localData, notes: importedNotes, plans: importedPlans }
        if (source.prefs && typeof source.prefs === 'object' && !Array.isArray(source.prefs)) {
          next.prefs = { ...defaultPrefs(), ...source.prefs }
        }
        localCommit(next)
      } else {
        localCommit({
          ...localData,
          notes: [...importedNotes, ...localData.notes],
          plans: [...importedPlans, ...localData.plans],
        })
      }
      return { notes: importedNotes.length, plans: importedPlans.length }
    }

    // ---------- session + composer bridge ----------

    function sessionRows(ctx) {
      try {
        const snapshot = ctx.sessions.list.getSnapshot()
        return Object.values(snapshot.byId ?? {})
      } catch {
        return []
      }
    }

    function mainSessionRow(ctx) {
      try {
        const selected = ctx.uiWorkspace?.selection?.getSnapshot?.()?.sessionId
        if (selected) {
          const row = sessionRows(ctx).find((item) => item.id === selected)
          if (row) return row
        }
      } catch {
        /* fall back to mainView retention */
      }
      return sessionRows(ctx).find((row) => (row?.retainedBy?.mainView ?? 0) > 0) ?? null
    }

    function messagesFromEntries(entries) {
      const messages = []
      let index = 0
      for (const entry of entries ?? []) {
        if (!entry || entry.type !== 'event' || !entry.event) continue
        const event = entry.event
        if (event.type === 'user/message') {
          index += 1
          messages.push({
            role: 'user',
            messageId: event.data?.id ?? event.data?.messageId ?? null,
            index,
            seq: event.seq ?? null,
            time: event.time ?? null,
            content: contentToText(event.data?.content),
          })
        } else if (event.type === 'assistant/message') {
          index += 1
          const message = event.data?.message ?? {}
          messages.push({
            role: 'assistant',
            messageId: message.id ?? null,
            index,
            seq: event.seq ?? null,
            time: message.time ?? event.time ?? null,
            content: contentToText(message.content),
          })
        }
      }
      return messages.filter((message) => message.content.trim() !== '')
    }

    async function loadMessages(ctx, sessionId) {
      if (!sessionId) return []
      let reference
      try {
        reference = ctx.sessions.retain(sessionId, { source: 'dsh-slipnote' })
        await reference.ready
        const binding = reference.binding
        const window = binding?.eventSource?.getSnapshot?.()
        return messagesFromEntries(window?.entries)
      } catch {
        return []
      } finally {
        try {
          reference?.release?.()
        } catch {
          /* ignore */
        }
      }
    }

    async function copyText(text) {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
          return true
        }
      } catch {
        /* fall through */
      }
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        area.remove()
        return ok
      } catch {
        return false
      }
    }

    async function appendDraft(shell, text) {
      const snapshot = shell.state.getSnapshot()
      const draft = snapshot?.draft ?? ''
      const next = draft.trim() === '' ? text : draft + '\n\n' + text
      shell.setDraft(next)
      try {
        await shell.actions?.persistDraft?.()
      } catch {
        /* persistence is best effort; the draft is still in the shell */
      }
      try {
        shell.focus?.()
      } catch {
        /* focus is best effort */
      }
      return next
    }

    function shellForRow(ctx, row) {
      try {
        return ctx.conversation.input.shell(row.id)
      } catch {
        /* try the AgentContext facade below */
      }
      try {
        const scoped = ctx.sessions.scope(row.id)
        if (scoped) return ctx.conversation.input.for(scoped)
      } catch {
        /* fall through */
      }
      return null
    }

    async function insertToComposer(ctx, text) {
      const value = String(text ?? '').trim()
      if (value === '') return 'empty'
      const row = mainSessionRow(ctx)
      if (row) {
        const shell = shellForRow(ctx, row)
        if (shell) {
          try {
            await appendDraft(shell, value)
            // The memo panel is the current main panel. Bring the conversation
            // back so the user can actually see the inserted draft.
            try {
              ctx.uiWorkspace.openSession(row.id)
            } catch {
              /* navigation is optional for the check below */
            }
            let draft = ''
            let inserted = false
            for (let attempt = 0; attempt < 10; attempt += 1) {
              await new Promise((resolve) => setTimeout(resolve, 50))
              try {
                draft = shell.state.getSnapshot()?.draft ?? ''
              } catch {
                draft = ''
              }
              if (draft.includes(value)) {
                inserted = true
                break
              }
              if (attempt === 0) {
                const retry = shellForRow(ctx, row)
                if (retry) {
                  try {
                    const currentDraft = retry.state.getSnapshot()?.draft ?? ''
                    if (!currentDraft.includes(value)) await appendDraft(retry, value)
                    draft = retry.state.getSnapshot()?.draft ?? ''
                  } catch {
                    draft = ''
                  }
                  if (draft.includes(value)) {
                    inserted = true
                    break
                  }
                }
              }
            }
            if (inserted) return 'inserted'
          } catch {
            /* fall back to clipboard */
          }
        }
      }
      return (await copyText(value)) ? 'copied' : 'no-session'
    }

    function jumpToSession(ctx, sessionId) {
      if (!sessionId) return false
      try {
        ctx.uiWorkspace.openSession(sessionId)
        return true
      } catch {
        try {
          ctx.uiWorkspace.openSession({ sessionId })
          return true
        } catch {
          return false
        }
      }
    }

    function deliverPrompt(ctx, prompt) {
      try {
        ctx.uiWorkspace.startSession(undefined, {
          prompt,
          whenDraftExists: 'append',
        })
        return true
      } catch {
        return false
      }
    }

    function downloadText(filename, text, type) {
      const blob = new Blob([text], { type: type ?? 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    }

    // ---------- images ----------

    const MAX_IMAGES = 6
    const IMAGE_MAX_EDGE = 1600
    const IMAGE_MAX_FILE_BYTES = 15 * 1024 * 1024
    const IMAGE_MAX_CHARS = 3_000_000

    function newImageId() {
      try {
        return `img_${crypto.randomUUID().replace(/-/g, '')}`
      } catch {
        return `img_${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`
      }
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(new Error('read-failed'))
        reader.readAsDataURL(file)
      })
    }

    function loadImageElement(src) {
      return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('image-decode-failed'))
        image.src = src
      })
    }

    async function prepareImage(file) {
      if (!file || !String(file.type ?? '').startsWith('image/')) {
        throw new Error('not-an-image')
      }
      if (file.size > IMAGE_MAX_FILE_BYTES) throw new Error('image-too-large')
      const original = await readFileAsDataUrl(file)
      const element = await loadImageElement(original)
      const width = element.naturalWidth || element.width || 0
      const height = element.naturalHeight || element.height || 0
      let finalWidth = width
      let finalHeight = height
      let dataUrl = original
      let mime = file.type || 'image/png'
      if (file.type !== 'image/gif' && (width > IMAGE_MAX_EDGE || height > IMAGE_MAX_EDGE)) {
        const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(width, height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(width * scale))
        canvas.height = Math.max(1, Math.round(height * scale))
        const cx = canvas.getContext('2d')
        if (cx) {
          cx.drawImage(element, 0, 0, canvas.width, canvas.height)
          dataUrl = canvas.toDataURL('image/webp', 0.82)
          if (dataUrl.startsWith('data:image/png')) dataUrl = canvas.toDataURL('image/jpeg', 0.82)
          mime = dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg'
          finalWidth = canvas.width
          finalHeight = canvas.height
        }
      }
      if (dataUrl.length > IMAGE_MAX_CHARS) throw new Error('image-too-large')
      return {
        id: newImageId(),
        name: (file.name || '粘贴图片').slice(0, 120),
        mime,
        dataUrl,
        width: finalWidth,
        height: finalHeight,
        size: file.size || 0,
      }
    }

    async function prepareImages(files) {
      const list = Array.from(files ?? []).filter((file) =>
        String(file?.type ?? '').startsWith('image/'),
      )
      if (list.length === 0) return []
      const images = []
      for (const file of list) images.push(await prepareImage(file))
      return images.slice(0, MAX_IMAGES)
    }

    // ---------- small components ----------

    function SidebarIcon({ size = 16, active = false }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          'aria-hidden': 'true',
          style: { opacity: active ? 1 : 0.9, flex: '0 0 auto' },
        },
        h('rect', {
          x: 4.5,
          y: 3,
          width: 15,
          height: 18,
          rx: 2.5,
          stroke: 'currentColor',
          strokeWidth: 1.7,
        }),
        h('path', {
          d: 'M8 8.5h8M8 12h8M8 15.5h5',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
        }),
        h('path', { d: 'M4.5 7h-1M4.5 12h-1M4.5 17h-1', stroke: 'currentColor', strokeWidth: 1.7 }),
      )
    }

    function Btn({ children, onClick, title, disabled, variant, type = 'button', className }) {
      return h(
        'button',
        {
          type,
          className: cx('dm-btn', variant && `dm-btn-${variant}`, className),
          onClick,
          title,
          disabled,
        },
        children,
      )
    }

    function Field({ label, children }) {
      return h(
        'label',
        { className: 'dm-field' },
        h('span', { className: 'dm-field-label' }, label),
        children,
      )
    }

    function Empty({ children }) {
      return h('div', { className: 'dm-empty' }, children)
    }

    function NoteBadge({ children, tone }) {
      return h('span', { className: cx('dm-badge', tone && `dm-badge-${tone}`) }, children)
    }

    // ---------- notes ----------

    function notesToTags(notes) {
      const seen = new Set()
      for (const note of notes) {
        for (const tag of note.tags ?? []) seen.add(tag)
      }
      return [...seen].sort()
    }

    function noteToDraft(note) {
      return {
        title: note.title,
        content: note.content,
        images: Array.isArray(note.images) ? note.images : [],
        tags: (note.tags ?? []).join(', '),
        pinned: Boolean(note.pinned),
        archived: Boolean(note.archived),
      }
    }

    function SnapshotPicker({ ctx, t, onClose, onPick }) {
      const rows = sessionRows(ctx)
      const [sessionId, setSessionId] = useState(
        () => mainSessionRow(ctx)?.id ?? rows[0]?.id ?? '',
      )
      const [messages, setMessages] = useState([])
      const [loading, setLoading] = useState(false)

      useEffect(() => {
        let alive = true
        if (!sessionId) {
          setMessages([])
          return undefined
        }
        setLoading(true)
        void loadMessages(ctx, sessionId).then((next) => {
          if (alive) {
            setMessages(next)
            setLoading(false)
          }
        })
        return () => {
          alive = false
        }
      }, [ctx, sessionId])

      const row = rows.find((item) => item.id === sessionId)

      return h(
        'div',
        { className: 'dm-modal-backdrop', onMouseDown: (event) => event.target === event.currentTarget && onClose() },
        h(
          'div',
          { className: 'dm-modal', role: 'dialog', 'aria-modal': 'true' },
          h(
            'div',
            { className: 'dm-modal-head' },
            h('strong', null, t('snapshot.title')),
            h(Btn, { variant: 'ghost', onClick: onClose, title: t('action.close') }, '×'),
          ),
          h(
            'div',
            { className: 'dm-modal-body' },
            h(
              Field,
              { label: t('snapshot.session') },
              h(
                'select',
                {
                  className: 'dm-input',
                  value: sessionId,
                  onChange: (event) => setSessionId(event.target.value),
                },
                rows.length === 0
                  ? h('option', { value: '' }, '—')
                  : rows.map((item) =>
                      h(
                        'option',
                        { key: item.id, value: item.id },
                        item.title || item.id,
                      ),
                    ),
              ),
            ),
            loading
              ? h('div', { className: 'dm-muted' }, t('snapshot.loading'))
              : messages.length === 0
                ? h(Empty, null, t('snapshot.empty'))
                : h(
                    'div',
                    { className: 'dm-message-list' },
                    messages
                      .slice()
                      .reverse()
                      .map((message) =>
                        h(
                          'div',
                          { className: 'dm-message', key: `${message.seq ?? message.index}` },
                          h(
                            'div',
                            { className: 'dm-message-meta' },
                            h(
                              NoteBadge,
                              { tone: message.role === 'user' ? 'blue' : 'green' },
                              t(`role.${message.role}`),
                            ),
                            h('span', null, `#${message.index}`),
                            message.time ? h('span', null, formatTime(message.time)) : null,
                          ),
                          h(
                            'div',
                            { className: 'dm-message-text' },
                            message.content.length > 600
                              ? `${message.content.slice(0, 600)}…`
                              : message.content,
                          ),
                          h(
                            Btn,
                            {
                              variant: 'primary',
                              onClick: () =>
                                onPick({
                                  sessionId,
                                  sessionTitle: row?.title ?? null,
                                  message,
                                }),
                            },
                            t('snapshot.save'),
                          ),
                        ),
                      ),
                  ),
          ),
        ),
      )
    }

    function NotesTab({ ctx, t, data, actions, notify, onError }) {
      const [query, setQuery] = useState('')
      const [tag, setTag] = useState('')
      const [includeArchived, setIncludeArchived] = useState(false)
      const [selectedId, setSelectedId] = useState(null)
      const [draft, setDraft] = useState(null)
      const [dirty, setDirty] = useState(false)
      const [pickerOpen, setPickerOpen] = useState(false)
      const [dragging, setDragging] = useState(false)
      const [imageBusy, setImageBusy] = useState(false)
      const fileRef = useRef(null)
      const imageRef = useRef(null)
      const lastSelectionRef = useRef('')

      useEffect(() => {
        function rememberSelection() {
          const text = String(window.getSelection?.()?.toString() ?? '').trim()
          if (text) lastSelectionRef.current = text
        }
        document.addEventListener('selectionchange', rememberSelection)
        return () => document.removeEventListener('selectionchange', rememberSelection)
      }, [])

      const notes = data.notes ?? []
      const tags = notesToTags(notes)
      const selected = notes.find((note) => note.id === selectedId) ?? null

      useEffect(() => {
        if (selected) {
          setDraft(noteToDraft(selected))
          setDirty(false)
        } else {
          setDraft(null)
          setDirty(false)
        }
      }, [selectedId, selected?.updatedAt])

      const visible = notes
        .filter((note) => includeArchived || !note.archived)
        .filter((note) => (tag ? note.tags.includes(tag) : true))
        .filter((note) => {
          const needle = query.trim().toLowerCase()
          if (!needle) return true
          return (
            note.title.toLowerCase().includes(needle) ||
            note.content.toLowerCase().includes(needle) ||
            (note.sessionTitle ?? '').toLowerCase().includes(needle) ||
            note.tags.some((item) => item.includes(needle)) ||
            (note.images ?? []).some((image) => image.name.toLowerCase().includes(needle))
          )
        })
        .sort((a, b) => {
          if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
          return (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
        })

      function changeDraft(patch) {
        setDraft((current) => (current ? { ...current, ...patch } : current))
        setDirty(true)
      }

      async function createNote() {
        try {
          const note = await actions.createNote({ title: '', content: '', source: 'manual' })
          setSelectedId(note.id)
          notify(t('toast.saved'))
        } catch (error) {
          onError(error)
        }
      }

      async function addImages(files) {
        const list = Array.from(files ?? []).filter((file) =>
          String(file?.type ?? '').startsWith('image/'),
        )
        if (list.length === 0) return
        setImageBusy(true)
        try {
          const images = await prepareImages(list)
          if (images.length === 0) return
          setDraft((current) => {
            if (!current) return current
            const merged = [...(current.images ?? []), ...images].slice(0, MAX_IMAGES)
            const autoTitle =
              !current.title.trim() || current.title === '未命名备忘录'
                ? titleFromContent(current.content, {
                    hasImages: merged.length > 0,
                    fallback: '未命名备忘录',
                  })
                : current.title
            return { ...current, title: autoTitle, images: merged }
          })
          setDirty(true)
        } catch (error) {
          notify(error?.message === 'image-too-large' ? t('image.tooLarge') : t('image.failed'))
        } finally {
          setImageBusy(false)
        }
      }

      function removeImage(id) {
        if (!draft) return
        setDraft((current) =>
          current ? { ...current, images: (current.images ?? []).filter((image) => image.id !== id) } : current,
        )
        setDirty(true)
      }

      async function saveNote() {
        if (!selected || !draft) return
        try {
          const saved = await actions.updateNote(selected.id, {
            title: draft.title,
            content: draft.content,
            images: draft.images ?? [],
            tags: parseTags(draft.tags),
            pinned: draft.pinned,
            archived: draft.archived,
          })
          setDraft(noteToDraft(saved))
          setDirty(false)
          notify(t('toast.saved'))
        } catch (error) {
          onError(error)
        }
      }

      async function removeNote() {
        if (!selected) return
        if (!window.confirm(t('confirm.deleteNote'))) return
        try {
          await actions.deleteNote(selected.id)
          setSelectedId(null)
          notify(t('toast.deleted'))
        } catch (error) {
          onError(error)
        }
      }

      async function togglePin(note) {
        try {
          await actions.updateNote(note.id, { pinned: !note.pinned })
        } catch (error) {
          onError(error)
        }
      }

      async function toggleArchive(note) {
        try {
          await actions.updateNote(note.id, { archived: !note.archived })
        } catch (error) {
          onError(error)
        }
      }

      async function insertNote(note) {
        try {
          if (!String(note.content ?? '').trim() && (note.images ?? []).length > 0) {
            notify(t('toast.imageOnly'))
            return
          }
          const result = await insertToComposer(ctx, note.content.trim() || note.title)
          if (result === 'inserted') notify(t('toast.inserted'))
          else if (result === 'copied') notify(t('toast.copied'))
          else if (result === 'no-session') notify(t('toast.noSession'))
          else notify(t('toast.insertFailed'))
        } catch (error) {
          onError(error)
        }
      }

      async function openSession(note) {
        if (!note.sessionId) return
        if (!jumpToSession(ctx, note.sessionId)) notify(t('toast.failed'))
      }

      async function captureSelection() {
        const text =
          lastSelectionRef.current ||
          String(window.getSelection?.()?.toString() ?? '').trim()
        if (!text) {
          notify(t('empty.selection'))
          return
        }
        const row = mainSessionRow(ctx)
        try {
          const note = await actions.createNote({
            title: titleFromContent(text, { fallback: t('note.selection') }),
            content: text,
            source: 'selection',
            sessionId: row?.id ?? null,
            sessionTitle: row?.title ?? null,
            messageTime: Date.now(),
          })
          lastSelectionRef.current = ''
          setSelectedId(note.id)
          notify(t('toast.saved'))
        } catch (error) {
          onError(error)
        }
      }

      async function saveSnapshot({ sessionId, sessionTitle, message }) {
        try {
          const note = await actions.createNote({
            title: titleFromContent(message.content, {
              fallback: `${t(`role.${message.role}`)} · ${sessionTitle ?? sessionId ?? ''}`.trim(),
            }),
            content: message.content,
            source: 'snapshot',
            sessionId,
            sessionTitle,
            messageIndex: message.index,
            messageSeq: message.seq,
            messageRole: message.role,
            messageTime: message.time ?? Date.now(),
          })
          setPickerOpen(false)
          setSelectedId(note.id)
          notify(t('toast.saved'))
        } catch (error) {
          onError(error)
        }
      }

      async function exportAs(format) {
        try {
          if (actions.offline()) {
            const content =
              format === 'md'
                ? buildLocalMarkdown(data)
                : JSON.stringify({ schemaVersion: 1, notes: data.notes, plans: data.plans, prefs: data.prefs }, null, 2)
            downloadText(`dsh-slipnote-${new Date().toISOString().slice(0, 10)}.${format}`, content)
          } else {
            const result = await request(`/export?format=${format === 'md' ? 'md' : 'json'}`)
            downloadText(result.filename, result.content, format === 'md' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8')
          }
          notify(t('toast.exported'))
        } catch (error) {
          onError(error)
        }
      }

      async function importFile(event) {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        try {
          const data = JSON.parse(await file.text())
          const mode = window.confirm(t('confirm.importReplace')) ? 'replace' : 'merge'
          await actions.importData(mode, data)
          notify(t('toast.imported'))
        } catch (error) {
          onError(error)
        }
      }

      async function dropText(event) {
        event.preventDefault()
        setDragging(false)
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
          String(file?.type ?? '').startsWith('image/'),
        )
        try {
          if (files.length > 0) {
            const images = await prepareImages(files)
            const note = await actions.createNote({
              title: '',
              content: '',
              images,
              source: 'manual',
            })
            setSelectedId(note.id)
            notify(t('toast.saved'))
            return
          }
          const text = event.dataTransfer?.getData('text/plain') ?? ''
          if (!text.trim()) return
          const note = await actions.createNote({
            title: titleFromContent(text, { fallback: t('note.selection') }),
            content: text,
            source: 'manual',
          })
          setSelectedId(note.id)
          notify(t('toast.saved'))
        } catch (error) {
          onError(error)
        }
      }

      return h(
        'div',
        { className: 'dm-workspace' },
        h(
          'aside',
          { className: 'dm-list-pane' },
          h(
            'div',
            { className: 'dm-toolbar' },
            h('input', {
              className: 'dm-input dm-search',
              value: query,
              placeholder: t('search.placeholder'),
              onChange: (event) => setQuery(event.target.value),
            }),
          ),
          h(
            'div',
            { className: 'dm-toolbar dm-toolbar-wrap' },
            h(
              'select',
              {
                className: 'dm-input dm-select',
                value: tag,
                onChange: (event) => setTag(event.target.value),
              },
              h('option', { value: '' }, t('filter.tags')),
              tags.map((item) => h('option', { key: item, value: item }, `#${item}`)),
            ),
            h(
              'label',
              { className: 'dm-check' },
              h('input', {
                type: 'checkbox',
                checked: includeArchived,
                onChange: (event) => setIncludeArchived(event.target.checked),
              }),
              t('filter.archived'),
            ),
          ),
          h(
            'div',
            { className: 'dm-toolbar dm-toolbar-wrap' },
            h(Btn, { variant: 'primary', onClick: createNote }, t('action.newNote')),
            h(Btn, { onClick: () => setPickerOpen(true) }, t('action.snapshot')),
            h(Btn, { onClick: captureSelection }, t('action.selection')),
          ),
          h(
            'div',
            { className: 'dm-toolbar dm-toolbar-wrap' },
            h(Btn, { onClick: () => exportAs('json') }, t('action.exportJson')),
            h(Btn, { onClick: () => exportAs('md') }, t('action.exportMd')),
            h(Btn, { onClick: () => fileRef.current?.click() }, t('action.import')),
            h('input', {
              ref: fileRef,
              type: 'file',
              accept: 'application/json,.json',
              style: { display: 'none' },
              onChange: importFile,
            }),
          ),
          h(
            'div',
            {
              className: cx('dm-list', dragging && 'dm-list-drop'),
              onDragOver: (event) => {
                event.preventDefault()
                setDragging(true)
              },
              onDragLeave: () => setDragging(false),
              onDrop: dropText,
            },
            visible.length === 0
              ? h(Empty, null, t('empty.notes'))
              : visible.map((note) =>
                  h(
                    'div',
                    {
                      key: note.id,
                      className: cx('dm-note', note.id === selectedId && 'dm-note-active'),
                      onClick: () => setSelectedId(note.id),
                      draggable: true,
                      onDragStart: (event) => {
                        event.dataTransfer.effectAllowed = 'copy'
                        event.dataTransfer.setData('text/plain', note.content || note.title)
                        event.dataTransfer.setData('text/x-dsh-slipnote-note', note.id)
                      },
                    },
                    h(
                      'div',
                      { className: 'dm-note-head' },
                      h('strong', { className: 'dm-note-title' }, note.pinned ? '★ ' : '', note.title || '—'),
                      h(
                        'span',
                        { className: 'dm-note-actions' },
                        h(Btn, {
                          variant: 'ghost',
                          title: note.pinned ? t('action.unpin') : t('action.pin'),
                          onClick: (event) => {
                            event.stopPropagation()
                            void togglePin(note)
                          },
                        }, note.pinned ? '★' : '☆'),
                        h(Btn, {
                          variant: 'ghost',
                          title: note.archived ? t('action.unarchive') : t('action.archive'),
                          onClick: (event) => {
                            event.stopPropagation()
                            void toggleArchive(note)
                          },
                        }, note.archived ? '↩' : '▣'),
                      ),
                    ),
                    (note.images ?? []).length > 0
                      ? h(
                          'div',
                          { className: 'dm-note-thumbs' },
                          note.images.slice(0, 3).map((image) =>
                            h('img', {
                              key: image.id,
                              src: image.dataUrl,
                              alt: image.name,
                              className: 'dm-note-thumb',
                            }),
                          ),
                        )
                      : null,
                    h(
                      'div',
                      { className: 'dm-note-excerpt' },
                      note.content.length > 140
                        ? `${note.content.slice(0, 140)}…`
                        : note.content || ((note.images ?? []).length > 0 ? t('note.image') : '—'),
                    ),
                    h(
                      'div',
                      { className: 'dm-note-meta' },
                      h(NoteBadge, null, t(`source.${note.source}`)),
                      (note.tags ?? []).slice(0, 3).map((item) => h('span', { key: item, className: 'dm-tag' }, `#${item}`)),
                      h('span', { className: 'dm-muted' }, formatTime(note.updatedAt)),
                    ),
                  ),
                ),
          ),
        ),
        h(
          'section',
          { className: 'dm-editor-pane' },
          !selected || !draft
            ? h(Empty, null, t('empty.notes'))
            : h(
                'div',
                { className: 'dm-editor' },
                h(
                  'div',
                  { className: 'dm-editor-head' },
                  h('span', { className: 'dm-muted' }, statusLine(noteToDraft(selected), t)),
                  h(
                    'span',
                    { className: 'dm-editor-actions' },
                    dirty ? h(NoteBadge, { tone: 'warn' }, '●') : null,
                    h(Btn, { variant: 'primary', onClick: saveNote, disabled: !dirty }, t('action.save')),
                    h(Btn, { onClick: () => insertNote(selected) }, t('action.insert')),
                    selected.sessionId
                      ? h(Btn, { onClick: () => openSession(selected) }, t('action.jump'))
                      : null,
                    h(Btn, { variant: 'danger', onClick: removeNote }, t('action.delete')),
                  ),
                ),
                h(Field, { label: t('editor.title') }, h('input', {
                  className: 'dm-input',
                  value: draft.title,
                  onChange: (event) => changeDraft({ title: event.target.value }),
                })),
                h(Field, { label: t('editor.content') }, h('textarea', {
                  className: 'dm-input dm-textarea dm-content-area',
                  value: draft.content,
                  onChange: (event) => changeDraft({ content: event.target.value }),
                  onPaste: (event) => {
                    const data = event.clipboardData
                    const files = Array.from(data?.files ?? [])
                    if (files.length === 0 && data?.items) {
                      for (const item of Array.from(data.items)) {
                        if (item?.kind === 'file') {
                          const file = item.getAsFile?.()
                          if (file) files.push(file)
                        }
                      }
                    }
                    const images = files.filter((file) =>
                      String(file?.type ?? '').startsWith('image/'),
                    )
                    if (images.length > 0) {
                      event.preventDefault()
                      void addImages(images)
                    }
                  },
                })),
                h(
                  Field,
                  { label: t('editor.images') },
                  h(
                    'div',
                    { className: 'dm-image-field' },
                    (draft.images ?? []).length > 0
                      ? h(
                          'div',
                          { className: 'dm-image-grid' },
                          draft.images.map((image) =>
                            h(
                              'div',
                              { className: 'dm-image-card', key: image.id },
                              h('img', {
                                src: image.dataUrl,
                                alt: image.name,
                                className: 'dm-image-preview',
                              }),
                              h(
                                'button',
                                {
                                  type: 'button',
                                  className: 'dm-image-remove',
                                  title: t('image.remove'),
                                  onClick: () => removeImage(image.id),
                                },
                                '×',
                              ),
                            ),
                          ),
                        )
                      : h('span', { className: 'dm-muted' }, t('image.empty')),
                    h(
                      Btn,
                      {
                        onClick: () => imageRef.current?.click(),
                        disabled: imageBusy || (draft.images ?? []).length >= MAX_IMAGES,
                      },
                      imageBusy ? t('action.addingImage') : t('action.addImage'),
                    ),
                    h('input', {
                      ref: imageRef,
                      type: 'file',
                      accept: 'image/*',
                      multiple: true,
                      style: { display: 'none' },
                      onChange: (event) => {
                        const files = event.target.files
                        event.target.value = ''
                        void addImages(files)
                      },
                    }),
                  ),
                ),
                h(Field, { label: t('editor.tags') }, h('input', {
                  className: 'dm-input',
                  value: draft.tags,
                  onChange: (event) => changeDraft({ tags: event.target.value }),
                })),
                h(
                  'div',
                  { className: 'dm-row' },
                  h('label', { className: 'dm-check' }, h('input', {
                    type: 'checkbox',
                    checked: draft.pinned,
                    onChange: (event) => changeDraft({ pinned: event.target.checked }),
                  }), t('action.pin')),
                  h('label', { className: 'dm-check' }, h('input', {
                    type: 'checkbox',
                    checked: draft.archived,
                    onChange: (event) => changeDraft({ archived: event.target.checked }),
                  }), t('action.archive')),
                ),
                selected.source === 'snapshot'
                  ? h(
                      'div',
                      { className: 'dm-source-box' },
                      h('div', null, `${t('snapshot.session')}: ${selected.sessionTitle ?? selected.sessionId ?? '—'}`),
                      h('div', null, `#${selected.messageIndex ?? '?'} · ${selected.messageRole ?? '—'} · ${formatTime(selected.messageTime)}`),
                    )
                  : null,
              ),
        ),
        pickerOpen
          ? h(SnapshotPicker, {
              ctx,
              t,
              onClose: () => setPickerOpen(false),
              onPick: saveSnapshot,
            })
          : null,
      )
    }

    function statusLine(draft, t) {
      const parts = []
      if (draft.pinned) parts.push(t('note.pinned'))
      if (draft.archived) parts.push(t('note.archived'))
      return parts.join(' · ')
    }

    function buildLocalMarkdown(data) {
      const lines = ['# DSH 备忘录导出', '', '## 备忘录', '']
      for (const note of data.notes ?? []) {
        lines.push(`### ${note.title}`, '', note.content, '')
        for (const image of note.images ?? []) {
          lines.push(`![${String(image.name ?? '图片').replace(/[[\]]/g, ' ')}](${image.dataUrl})`, '')
        }
      }
      lines.push('## 计划书', '')
      for (const plan of data.plans ?? []) {
        const progress = progressOf(plan)
        lines.push(`### ${plan.title}（${progress.done}/${progress.total}）`, '')
        for (const stage of plan.stages ?? []) {
          lines.push(`#### ${stage.title}`, '')
          for (const step of stage.steps ?? []) {
            lines.push(`- [${step.status === 'done' ? 'x' : ' '}] ${step.text}（${step.status}）`)
          }
          lines.push('')
        }
      }
      return lines.join('\n')
    }

    // ---------- plans ----------

    function deepClone(value) {
      try {
        return structuredClone(value)
      } catch {
        return JSON.parse(JSON.stringify(value))
      }
    }

    function planToDraft(plan) {
      return deepClone(plan)
    }

    function PlansTab({ ctx, t, data, actions, notify, onError }) {
      const plans = data.plans ?? []
      const [selectedId, setSelectedId] = useState(() => data.prefs.lastPlanId ?? plans[0]?.id ?? null)
      const [draft, setDraft] = useState(null)
      const [dirty, setDirty] = useState(false)
      const [drag, setDrag] = useState(null)

      const selected = plans.find((plan) => plan.id === selectedId) ?? null

      useEffect(() => {
        if (!selected && plans.length > 0) setSelectedId(plans[0].id)
      }, [plans.length, selected])

      useEffect(() => {
        if (selected) {
          setDraft(planToDraft(selected))
          setDirty(false)
        } else {
          setDraft(null)
          setDirty(false)
        }
      }, [selectedId, selected?.updatedAt])

      function changeDraft(mutator) {
        setDraft((current) => {
          if (!current) return current
          const next = deepClone(current)
          mutator(next)
          next.updatedAt = Date.now()
          return next
        })
        setDirty(true)
      }

      async function createPlan() {
        try {
          const plan = await actions.createPlan({
            title: t('action.newPlan'),
            stages: [{ id: uid('st'), title: '阶段一', order: 0, steps: [] }],
          })
          setSelectedId(plan.id)
          notify(t('toast.saved'))
        } catch (error) {
          onError(error)
        }
      }

      async function savePlan() {
        if (!selected || !draft) return
        try {
          const saved = await actions.updatePlan(selected.id, {
            title: draft.title,
            archived: draft.archived,
            stages: draft.stages,
          })
          setDraft(planToDraft(saved))
          setDirty(false)
          notify(t('toast.saved'))
        } catch (error) {
          onError(error)
        }
      }

      async function removePlan() {
        if (!selected) return
        if (!window.confirm(t('confirm.deletePlan'))) return
        try {
          await actions.deletePlan(selected.id)
          setSelectedId(null)
          notify(t('toast.deleted'))
        } catch (error) {
          onError(error)
        }
      }

      function addStage() {
        changeDraft((plan) => {
          plan.stages.push({
            id: uid('st'),
            title: t('stage.new'),
            order: plan.stages.length,
            steps: [],
          })
          plan.stages.forEach((stage, index) => {
            stage.order = index
          })
        })
      }

      function addStep(stageId) {
        changeDraft((plan) => {
          const stage = plan.stages.find((item) => item.id === stageId)
          if (!stage) return
          stage.steps.push({
            id: uid('sp'),
            text: t('step.new'),
            status: 'todo',
            note: '',
            order: stage.steps.length,
            doneAt: null,
          })
        })
      }

      function removeStage(stageId) {
        changeDraft((plan) => {
          plan.stages = plan.stages.filter((stage) => stage.id !== stageId)
          plan.stages.forEach((stage, index) => {
            stage.order = index
          })
        })
      }

      function removeStep(stageId, stepId) {
        changeDraft((plan) => {
          const stage = plan.stages.find((item) => item.id === stageId)
          if (!stage) return
          stage.steps = stage.steps.filter((step) => step.id !== stepId)
          stage.steps.forEach((step, index) => {
            step.order = index
          })
        })
      }

      function moveStage(stageId, direction) {
        changeDraft((plan) => {
          const index = plan.stages.findIndex((stage) => stage.id === stageId)
          const target = index + direction
          if (index < 0 || target < 0 || target >= plan.stages.length) return
          const [stage] = plan.stages.splice(index, 1)
          plan.stages.splice(target, 0, stage)
          plan.stages.forEach((item, order) => {
            item.order = order
          })
        })
      }

      function toggleStep(stageId, stepId) {
        changeDraft((plan) => {
          const stage = plan.stages.find((item) => item.id === stageId)
          const step = stage?.steps.find((item) => item.id === stepId)
          if (!step) return
          if (step.status === 'done') {
            step.status = 'todo'
            step.doneAt = null
          } else {
            step.status = 'done'
            step.doneAt = Date.now()
          }
        })
      }

      function dropStep(targetStageId, targetIndex) {
        if (!drag) return
        changeDraft((plan) => {
          const fromStage = plan.stages.find((stage) => stage.id === drag.stageId)
          const toStage = plan.stages.find((stage) => stage.id === targetStageId)
          if (!fromStage || !toStage) return
          const fromIndex = fromStage.steps.findIndex((step) => step.id === drag.stepId)
          if (fromIndex < 0) return
          const [moved] = fromStage.steps.splice(fromIndex, 1)
          let index = targetIndex
          if (fromStage === toStage && fromIndex < targetIndex) index -= 1
          index = Math.max(0, Math.min(index, toStage.steps.length))
          toStage.steps.splice(index, 0, moved)
          plan.stages.forEach((stage) => {
            stage.steps.forEach((step, order) => {
              step.order = order
            })
          })
        })
        setDrag(null)
      }

      function deliver(stage, step) {
        const prompt = t('deliver.prompt')
          .replace('{plan}', draft?.title ?? selected?.title ?? '')
          .replace('{stage}', stage.title)
          .replace('{step}', step.text)
          .replace('{status}', t(`status.${step.status}`))
          .replace('{note}', step.note || '—')
        if (deliverPrompt(ctx, prompt)) notify(t('toast.inserted'))
        else notify(t('toast.failed'))
      }

      const progress = draft ? progressOf(draft) : progressOf(selected ?? { stages: [] })

      return h(
        'div',
        { className: 'dm-workspace' },
        h(
          'aside',
          { className: 'dm-list-pane' },
          h(
            'div',
            { className: 'dm-toolbar' },
            h(Btn, { variant: 'primary', onClick: createPlan }, t('action.newPlan')),
          ),
          h(
            'div',
            { className: 'dm-list' },
            plans.length === 0
              ? h(Empty, null, t('empty.plans'))
              : plans.map((plan) => {
                  const planProgress = progressOf(plan)
                  return h(
                    'div',
                    {
                      key: plan.id,
                      className: cx('dm-note', plan.id === selectedId && 'dm-note-active'),
                      onClick: () => setSelectedId(plan.id),
                    },
                    h(
                      'div',
                      { className: 'dm-note-head' },
                      h('strong', { className: 'dm-note-title' }, plan.title || '—'),
                      plan.archived ? h(NoteBadge, null, t('plan.archived')) : null,
                    ),
                    h(
                      'div',
                      { className: 'dm-note-meta' },
                      h('span', null, `${planProgress.done}/${planProgress.total}`),
                      h('span', { className: 'dm-muted' }, formatTime(plan.updatedAt)),
                    ),
                  )
                }),
          ),
        ),
        h(
          'section',
          { className: 'dm-editor-pane' },
          !selected || !draft
            ? h(Empty, null, t('empty.plans'))
            : h(
                'div',
                { className: 'dm-editor' },
                h(
                  'div',
                  { className: 'dm-editor-head' },
                  h(
                    'div',
                    { className: 'dm-progress' },
                    h('div', { className: 'dm-progress-label' }, `${t('progress')}: ${progress.done}/${progress.total} (${progress.percent}%)`),
                    h('div', { className: 'dm-progress-bar' }, h('div', { style: { width: `${progress.percent}%` } })),
                  ),
                  h(
                    'span',
                    { className: 'dm-editor-actions' },
                    dirty ? h(NoteBadge, { tone: 'warn' }, '●') : null,
                    h(Btn, { variant: 'primary', onClick: savePlan, disabled: !dirty }, t('action.save')),
                    h(Btn, { variant: 'danger', onClick: removePlan }, t('action.delete')),
                  ),
                ),
                h(Field, { label: t('editor.planTitle') }, h('input', {
                  className: 'dm-input',
                  value: draft.title,
                  onChange: (event) => changeDraft((plan) => { plan.title = event.target.value }),
                })),
                h(
                  'div',
                  { className: 'dm-row' },
                  h('label', { className: 'dm-check' }, h('input', {
                    type: 'checkbox',
                    checked: Boolean(draft.archived),
                    onChange: (event) => changeDraft((plan) => { plan.archived = event.target.checked }),
                  }), t('action.archive')),
                  h(Btn, { onClick: addStage }, t('action.addStage')),
                ),
                h(
                  'div',
                  { className: 'dm-stages' },
                  draft.stages.map((stage, stageIndex) =>
                    h(
                      'div',
                      { className: 'dm-stage', key: stage.id },
                      h(
                        'div',
                        { className: 'dm-stage-head' },
                        h('input', {
                          className: 'dm-input dm-stage-title',
                          value: stage.title,
                          onChange: (event) =>
                            changeDraft((plan) => {
                              const target = plan.stages.find((item) => item.id === stage.id)
                              if (target) target.title = event.target.value
                            }),
                        }),
                        h(
                          'span',
                          { className: 'dm-stage-actions' },
                          h(Btn, { variant: 'ghost', onClick: () => moveStage(stage.id, -1), disabled: stageIndex === 0, title: t('action.moveUp') }, '↑'),
                          h(Btn, { variant: 'ghost', onClick: () => moveStage(stage.id, 1), disabled: stageIndex === draft.stages.length - 1, title: t('action.moveDown') }, '↓'),
                          h(Btn, { variant: 'ghost', onClick: () => removeStage(stage.id), title: t('action.remove') }, '×'),
                        ),
                      ),
                      h(
                        'div',
                        {
                          className: 'dm-steps',
                          onDragOver: (event) => event.preventDefault(),
                          onDrop: (event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            dropStep(stage.id, stage.steps.length)
                          },
                        },
                        stage.steps.map((step, stepIndex) =>
                          h(
                            'div',
                            {
                              className: cx('dm-step', drag?.stepId === step.id && 'dm-step-dragging'),
                              key: step.id,
                              draggable: true,
                              onDragStart: (event) => {
                                setDrag({ stageId: stage.id, stepId: step.id })
                                event.dataTransfer.effectAllowed = 'move'
                                event.dataTransfer.setData('text/plain', step.text)
                              },
                              onDragEnd: () => setDrag(null),
                              onDragOver: (event) => event.preventDefault(),
                              onDrop: (event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                dropStep(stage.id, stepIndex)
                              },
                            },
                            h(
                              'div',
                              { className: 'dm-step-main' },
                              h('span', { className: 'dm-drag-handle', title: 'Drag' }, '⋮⋮'),
                              h('input', {
                                type: 'checkbox',
                                checked: step.status === 'done',
                                onChange: () => toggleStep(stage.id, step.id),
                              }),
                              h('input', {
                                className: 'dm-input dm-step-text',
                                value: step.text,
                                onChange: (event) =>
                                  changeDraft((plan) => {
                                    const target = plan.stages
                                      .find((item) => item.id === stage.id)
                                      ?.steps.find((item) => item.id === step.id)
                                    if (target) target.text = event.target.value
                                  }),
                              }),
                              h(
                                'select',
                                {
                                  className: 'dm-input dm-status',
                                  value: step.status,
                                  onChange: (event) =>
                                    changeDraft((plan) => {
                                      const target = plan.stages
                                        .find((item) => item.id === stage.id)
                                        ?.steps.find((item) => item.id === step.id)
                                      if (!target) return
                                      target.status = event.target.value
                                      target.doneAt = event.target.value === 'done' ? Date.now() : null
                                    }),
                                },
                                ['todo', 'doing', 'done', 'hold'].map((value) =>
                                  h('option', { key: value, value }, t(`status.${value}`)),
                                ),
                              ),
                              h(Btn, { variant: 'ghost', onClick: () => removeStep(stage.id, step.id), title: t('action.remove') }, '×'),
                            ),
                            h(
                              'details',
                              { className: 'dm-step-details' },
                              h('summary', null, t('editor.note')),
                              h('textarea', {
                                className: 'dm-input dm-textarea dm-note-area',
                                value: step.note,
                                onChange: (event) =>
                                  changeDraft((plan) => {
                                    const target = plan.stages
                                      .find((item) => item.id === stage.id)
                                      ?.steps.find((item) => item.id === step.id)
                                    if (target) target.note = event.target.value
                                  }),
                              }),
                              h(
                                'div',
                                { className: 'dm-step-foot' },
                                h(Btn, { variant: 'primary', onClick: () => deliver(stage, step) }, t('action.deliver')),
                                step.doneAt ? h('span', { className: 'dm-muted' }, `${t('step.doneAt')}: ${formatTime(step.doneAt)}`) : null,
                              ),
                            ),
                          ),
                        ),
                        h(
                          'div',
                          { className: 'dm-stage-foot' },
                          h(Btn, { onClick: () => addStep(stage.id) }, t('action.addStep')),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
        ),
      )
    }

    // ---------- panel ----------

    const CSS = `
.dm-panel{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:13px/1.5 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
.dm-header{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);flex:0 0 auto}
.dm-title{display:flex;align-items:center;gap:8px;font-weight:650;letter-spacing:.01em;white-space:nowrap}
.dm-tabs{display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--dsw-alias-bg-layer-2)}
.dm-tab{border:0;background:transparent;color:var(--dsw-alias-label-secondary);padding:5px 12px;border-radius:6px;cursor:pointer;font:inherit}
.dm-tab-active{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 0 0 1px var(--dsw-alias-border-l1)}
.dm-head-actions{margin-left:auto;display:flex;gap:6px;align-items:center}
.dm-body{display:flex;flex:1;min-height:0}
.dm-workspace{display:flex;flex:1;min-height:0;width:100%}
.dm-list-pane{width:330px;min-width:240px;max-width:45%;display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.dm-editor-pane{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:auto}
.dm-toolbar{display:flex;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:0 0 auto}
.dm-toolbar-wrap{flex-wrap:wrap}
.dm-list{flex:1;overflow:auto;min-height:0;padding:4px}
.dm-list-drop{outline:2px dashed var(--dsw-alias-brand-primary);outline-offset:-4px;background:var(--dsw-alias-bg-layer-2)}
.dm-note{padding:8px 9px;border-radius:8px;cursor:pointer;border:1px solid transparent}
.dm-note:hover{background:var(--dsw-alias-bg-layer-2)}
.dm-note-active{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.dm-note-head{display:flex;align-items:center;gap:6px}
.dm-note-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dm-note-actions{display:flex;gap:2px;opacity:.75}
.dm-note-excerpt{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:3px;max-height:36px;overflow:hidden}
.dm-note-thumbs{display:flex;gap:5px;margin-top:5px}
.dm-note-thumb{width:54px;height:40px;object-fit:cover;border-radius:4px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.dm-image-field{display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.dm-image-grid{display:flex;flex-wrap:wrap;gap:8px}
.dm-image-card{position:relative}
.dm-image-preview{max-width:180px;max-height:140px;border-radius:5px;border:1px solid var(--dsw-alias-border-l1);display:block}
.dm-image-remove{position:absolute;top:-7px;right:-7px;width:20px;height:20px;border-radius:50%;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);cursor:pointer;line-height:1}
.dm-note-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:5px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.dm-tag{color:var(--dsw-alias-brand-primary)}
.dm-badge{display:inline-flex;align-items:center;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:0 6px;font-size:10px;line-height:17px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.dm-badge-blue{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.dm-badge-green{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.dm-badge-warn{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}
.dm-editor{padding:12px 14px 40px;display:flex;flex-direction:column;gap:10px;max-width:1000px;width:100%}
.dm-editor-head{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.dm-editor-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.dm-btn{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:7px;padding:5px 9px;font:inherit;cursor:pointer;line-height:1.3}
.dm-btn:hover:not(:disabled){border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2)}
.dm-btn:disabled{opacity:.45;cursor:default}
.dm-btn-primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff}
.dm-btn-primary:hover:not(:disabled){filter:brightness(1.08);background:var(--dsw-alias-brand-primary)}
.dm-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.dm-btn-ghost{border-color:transparent;background:transparent;padding:2px 6px;color:var(--dsw-alias-label-secondary)}
.dm-input{width:100%;box-sizing:border-box;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:7px;padding:6px 8px;font:inherit;outline:none}
.dm-input:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent)}
.dm-select{width:auto;max-width:100%}
.dm-search{flex:1}
.dm-field{display:flex;flex-direction:column;gap:4px}
.dm-field-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dm-textarea{resize:vertical;min-height:90px}
.dm-content-area{min-height:220px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12.5px}
.dm-note-area{min-height:70px}
.dm-check{display:inline-flex;align-items:center;gap:5px;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer;user-select:none}
.dm-check input{accent-color:var(--dsw-alias-brand-primary)}
.dm-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.dm-empty{padding:28px 18px;color:var(--dsw-alias-label-secondary);text-align:center;font-size:12.5px}
.dm-muted{color:var(--dsw-alias-label-secondary)}
.dm-source-box{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:8px 10px;font-size:11.5px;color:var(--dsw-alias-label-secondary);display:flex;flex-direction:column;gap:2px}
.dm-modal-backdrop{position:fixed;inset:0;background:var(--dsw-alias-bg-overlay);display:flex;align-items:center;justify-content:center;padding:24px;z-index:1000}
.dm-modal{width:min(860px,92vw);max-height:84vh;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}
.dm-modal-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.dm-modal-body{padding:12px 14px;overflow:auto;display:flex;flex-direction:column;gap:10px}
.dm-message-list{display:flex;flex-direction:column;gap:8px}
.dm-message{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:8px 10px;background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:6px}
.dm-message-meta{display:flex;gap:8px;align-items:center;font-size:11px;color:var(--dsw-alias-label-secondary)}
.dm-message-text{white-space:pre-wrap;word-break:break-word;font-size:12.5px;max-height:170px;overflow:auto}
.dm-stages{display:flex;flex-direction:column;gap:12px}
.dm-stage{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.dm-stage-head{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.dm-stage-title{font-weight:650;border-color:transparent;background:transparent;padding:3px 5px}
.dm-stage-title:focus{background:var(--dsw-alias-bg-base)}
.dm-stage-actions{display:flex;gap:2px;margin-left:auto}
.dm-steps{display:flex;flex-direction:column}
.dm-step{border-bottom:1px solid var(--dsw-alias-border-l1);padding:7px 8px}
.dm-step:last-child{border-bottom:0}
.dm-step-dragging{opacity:.5}
.dm-step-main{display:flex;gap:6px;align-items:center}
.dm-drag-handle{cursor:grab;color:var(--dsw-alias-label-secondary);font-size:11px;letter-spacing:-2px;user-select:none}
.dm-step-text{flex:1;min-width:80px}
.dm-status{width:auto;flex:0 0 auto;padding:4px 6px;font-size:12px}
.dm-step-details{margin:6px 0 0 30px}
.dm-step-details summary{cursor:pointer;font-size:11px;color:var(--dsw-alias-label-secondary);user-select:none}
.dm-step-details[open] summary{margin-bottom:5px}
.dm-step-foot{display:flex;gap:10px;align-items:center;margin-top:6px;flex-wrap:wrap}
.dm-stage-foot{padding:5px 8px;border-top:1px dashed var(--dsw-alias-border-l1)}
.dm-progress{display:flex;flex-direction:column;gap:3px;min-width:180px}
.dm-progress-label{font-size:11px;color:var(--dsw-alias-label-secondary)}
.dm-progress-bar{height:5px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.dm-progress-bar>div{height:100%;background:var(--dsw-alias-brand-primary);border-radius:999px;transition:width .2s}
.dm-loading{padding:40px;text-align:center;color:var(--dsw-alias-label-secondary)}
.dm-warning{margin:0;padding:7px 14px;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l1);font-size:11.5px;color:var(--dsw-alias-state-warn-primary);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dm-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:7px 14px;z-index:1100;font-size:12px;box-shadow:0 8px 30px rgba(0,0,0,.3);max-width:80vw}
@media (max-width:760px){.dm-list-pane{width:42%;min-width:180px}.dm-editor{padding:10px}.dm-title span{display:none}}
`

    function Panel({ ctx, t }) {
      const [data, setData] = useState(emptyData)
      const [loading, setLoading] = useState(true)
      const [offline, setOffline] = useState(false)
      const [error, setError] = useState('')
      const [toast, setToast] = useState('')
      const [activeTab, setActiveTab] = useState('notes')
      const [hydrated, setHydrated] = useState(false)
      const offlineRef = useRef(false)

      useEffect(() => {
        if (!toast) return undefined
        const timer = setTimeout(() => setToast(''), 2800)
        return () => clearTimeout(timer)
      }, [toast])

      function notify(message) {
        setToast(message)
      }

      function onError(err) {
        const message = err?.message ?? String(err)
        setError(message)
        setToast(message)
      }

      async function reload({ quiet = false } = {}) {
        if (!quiet) setLoading(true)
        try {
          const next = await request('/bootstrap')
          setData(next)
          setOffline(false)
          offlineRef.current = false
          setError('')
          writeCache(next)
        } catch (err) {
          const cache = readCache()
          if (cache) {
            setData(cache)
            setOffline(true)
            offlineRef.current = true
            setError('')
          } else {
            setData(emptyData())
            setOffline(true)
            offlineRef.current = true
            setError(err?.message ?? String(err))
          }
        } finally {
          if (!quiet) setLoading(false)
        }
      }

      useEffect(() => {
        void reload()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      useEffect(() => {
        const onChange = () => {
          void reload({ quiet: true })
        }
        window.addEventListener(CHANGE_EVENT, onChange)
        return () => window.removeEventListener(CHANGE_EVENT, onChange)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      useEffect(() => {
        if (!loading && !hydrated) {
          setActiveTab(data.prefs.activeTab === 'plans' ? 'plans' : 'notes')
          setHydrated(true)
        }
      }, [loading, hydrated, data.prefs.activeTab])

      async function setPrefs(patch) {
        if (offlineRef.current) {
          const prefs = localSetPrefs(patch)
          setData({ ...localData, prefs })
          return prefs
        }
        try {
          const result = await request('/prefs', { method: 'PUT', body: patch })
          setData((current) => {
            const next = { ...current, prefs: result.prefs }
            writeCache(next)
            return next
          })
          return result.prefs
        } catch (err) {
          onError(err)
          return null
        }
      }

      const actions = {
        offline: () => offlineRef.current,
        async createNote(input) {
          if (offlineRef.current) {
            const note = localCreateNote(input)
            setData({ ...localData })
            return note
          }
          const result = await request('/notes', { method: 'POST', body: input })
          await reload({ quiet: true })
          return result.note
        },
        async updateNote(id, patch) {
          if (offlineRef.current) {
            const note = localUpdateNote(id, patch)
            setData({ ...localData })
            return note
          }
          const result = await request(`/notes/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: patch,
          })
          await reload({ quiet: true })
          return result.note
        },
        async deleteNote(id) {
          if (offlineRef.current) {
            localDeleteNote(id)
            setData({ ...localData })
            return
          }
          await request(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE' })
          await reload({ quiet: true })
        },
        async createPlan(input) {
          if (offlineRef.current) {
            const plan = localCreatePlan(input)
            setData({ ...localData })
            return plan
          }
          const result = await request('/plans', { method: 'POST', body: input })
          await reload({ quiet: true })
          return result.plan
        },
        async updatePlan(id, patch) {
          if (offlineRef.current) {
            const plan = localUpdatePlan(id, patch)
            setData({ ...localData })
            return plan
          }
          const result = await request(`/plans/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: patch,
          })
          await reload({ quiet: true })
          return result.plan
        },
        async deletePlan(id) {
          if (offlineRef.current) {
            localDeletePlan(id)
            setData({ ...localData })
            return
          }
          await request(`/plans/${encodeURIComponent(id)}`, { method: 'DELETE' })
          await reload({ quiet: true })
        },
        async importData(mode, payload) {
          if (offlineRef.current) {
            localImportData(mode, payload)
            setData({ ...localData })
            return
          }
          await request('/import', { method: 'POST', body: { mode, data: payload } })
          await reload({ quiet: true })
        },
      }

      function changeTab(tab) {
        setActiveTab(tab)
        void setPrefs({ activeTab: tab })
      }

      function close() {
        try {
          ctx.layout.selectPanel(null)
        } catch {
          /* host may already have moved on */
        }
      }

      const warnings = data.storage?.warnings ?? []
      const readonly = Boolean(data.storage?.readOnly)

      return h(
        'div',
        { className: 'dm-panel' },
        h('style', { key: 'dsh-slipnote-style' }, CSS),
        h(
          'div',
          { className: 'dm-header' },
          h('div', { className: 'dm-title' }, h(SidebarIcon, { size: 18 }), h('span', null, t('title'))),
          h(
            'div',
            { className: 'dm-tabs' },
            h(
              'button',
              {
                type: 'button',
                className: cx('dm-tab', activeTab === 'notes' && 'dm-tab-active'),
                onClick: () => changeTab('notes'),
              },
              t('tab.notes'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: cx('dm-tab', activeTab === 'plans' && 'dm-tab-active'),
                onClick: () => changeTab('plans'),
              },
              t('tab.plans'),
            ),
          ),
          h(
            'div',
            { className: 'dm-head-actions' },
            offline ? h(NoteBadge, { tone: 'warn' }, t('storage.local')) : null,
            readonly ? h(NoteBadge, { tone: 'warn' }, t('storage.readonly')) : null,
            h(Btn, { variant: 'ghost', onClick: () => void reload(), title: t('action.refresh') }, '⟳'),
            h(Btn, { variant: 'ghost', onClick: close, title: t('action.close') }, '×'),
          ),
        ),
        warnings.length > 0
          ? h(
              'div',
              { className: 'dm-warning' },
              h('strong', null, `${t('storage.warnings')}:`),
              h('span', null, warnings.join(' ')),
            )
          : null,
        error ? h('div', { className: 'dm-warning' }, error) : null,
        h(
          'div',
          { className: 'dm-body' },
          loading && data.notes.length === 0 && data.plans.length === 0
            ? h('div', { className: 'dm-loading' }, t('loading'))
            : activeTab === 'plans'
              ? h(PlansTab, { ctx, t, data, actions, notify, onError })
              : h(NotesTab, { ctx, t, data, actions, notify, onError }),
        ),
        toast ? h('div', { className: 'dm-toast' }, toast) : null,
      )
    }

    function apply(ctx) {
      const t = ctx.locale.bind(NS)
      ctx.effect(() => ctx.locale.register(NS, 'zh', ZH))
      ctx.effect(() => ctx.locale.register(NS, 'en', EN))

      ctx.effect(() => {
        let disposePanel
        let disposeRow
        let disposeAction
        const disposePanelInject = ctx.slots.inject('main', () => {
          disposePanel = ctx.slots.register(
            { name: 'main', key: 'dsh-slipnote', locale: NS },
            () => h(Panel, { ctx, t }),
          )
          return disposePanel
        })
        const disposeRowInject = ctx.slots.inject('sidebar.panellist', () => {
          disposeRow = ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: 'dsh-slipnote',
              order: 5,
              label: () => t('nav'),
              locale: NS,
            },
            (owner = {}) => h(SidebarIcon, { size: owner.size ?? 16, active: Boolean(owner.active) }),
          )
          return disposeRow
        })
        const disposeActionInject = ctx.slots.inject('conversation.chat.assistant-actions', () => {
          disposeAction = ctx.slots.register(
            {
              name: 'conversation.chat.assistant-actions',
              id: 'dsh-slipnote-save',
              order: 20,
              label: () => t('message.saveToMemo'),
              locale: NS,
            },
            (owner = {}) => h(AssistantMemoAction, Object.assign({}, owner, { memoCtx: ctx, t })),
          )
          return disposeAction
        })
        return () => {
          try {
            disposePanelInject?.()
          } catch {
            /* ignore */
          }
          try {
            disposeRowInject?.()
          } catch {
            /* ignore */
          }
          try {
            disposeActionInject?.()
          } catch {
            /* ignore */
          }
          disposePanel?.()
          disposeRow?.()
          disposeAction?.()
        }
      })
    }

    return {
      inject: ['slots', 'locale', 'layout', 'sessions', 'conversation', 'uiWorkspace'],
      apply,
      __test: {
        contentToText,
        titleFromContent,
        localImages,
        messagesFromEntries,
        firstLine,
        parseTags,
        progressOf,
        emptyData,
        noteFromMessage,
        AssistantMemoAction,
        localCreateNote,
        localUpdateNote,
        localCreatePlan,
        localUpdatePlan,
        localImportData,
        localData: () => localData,
        resetLocal: () => {
          localData = emptyData()
          writeCache(localData)
        },
        noteToDraft,
        Panel,
        NotesTab,
        PlansTab,
      },
    }
  },
})
