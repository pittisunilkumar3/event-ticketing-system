// Keep late/aborted preview responses from replacing the current draft.
export function requestEmailPreview(api, config, ticketTypeId, callbacks, delay = 150, timers = window) {
  const controller = new AbortController();
  const timer = timers.setTimeout(async () => {
    try {
      const {data} = await api.post('/admin/studio/email-preview', {config, ticket_type_id:ticketTypeId || undefined, preview_formats:true}, {signal:controller.signal,timeout:15000});
      if (!controller.signal.aborted) callbacks.success(data.data);
    } catch (error) {
      if (!controller.signal.aborted) callbacks.error(error);
    } finally {
      if (!controller.signal.aborted) callbacks.settled();
    }
  }, delay);
  return () => {timers.clearTimeout(timer);controller.abort();};
}
export const previewFormat = (preview, format) => preview?.formats?.[format] || preview?.html;
