# Warn if the webhook endpoint is unprotected in production.
Rails.application.config.after_initialize do
  if Rails.env.production? && ENV["MISSION_CONTROL_WEBHOOK_TOKEN"].blank?
    Rails.logger.warn(
      "[SECURITY] MISSION_CONTROL_WEBHOOK_TOKEN is not set. " \
      "The webhook endpoint at /api/v1/openclaw/webhook is accepting unauthenticated requests. " \
      "Set MISSION_CONTROL_WEBHOOK_TOKEN in your environment to require token authentication."
    )
  end
end
