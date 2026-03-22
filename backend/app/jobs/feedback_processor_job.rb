# Processes a user feedback item by asking OpenClaw to draft a response,
# suggest a code change, or generate a branch name for a feature request.
#
# This keeps all AI calls LOCAL — we talk to the local OpenClaw gateway only.
# No data is sent to external services.
class FeedbackProcessorJob < ApplicationJob
  queue_as :default

  def perform(feedback_id)
    feedback = Feedback.find_by(id: feedback_id)
    return unless feedback

    feedback.update!(status: "processing")

    prompt = build_prompt(feedback)

    begin
      client   = Openclaw::GatewayClient.new
      response = client.chat_send(
        content:    prompt,
        agent_id:   "main",
        session_id: "feedback-#{feedback.id}"
      )

      ai_text     = response.dig("message", "content") || response["content"] || ""
      branch_name = extract_branch_name(ai_text, feedback)

      feedback.update!(
        status:      "done",
        ai_response: ai_text,
        branch_name: branch_name
      )

      EventStore.emit(
        type:     "feedback_processed",
        message:  "Feedback '#{feedback.title}' processed — #{branch_name || 'no branch suggested'}",
        metadata: { feedback_id: feedback.id }
      )

      ActionCable.server.broadcast("agent_events", {
        event:       "feedback_updated",
        feedback_id: feedback.id,
        status:      "done"
      })
    rescue => e
      feedback.update!(status: "failed", ai_response: "Error: #{e.message}")
      Rails.logger.error "[FeedbackProcessorJob] Failed for #{feedback_id}: #{e.message}"
    end
  end

  private

  def build_prompt(feedback)
    type_label = feedback.feedback_type.capitalize

    <<~PROMPT
      A user submitted a #{type_label} report for the Crabby's Mission Control app.

      Title: #{feedback.title}
      Description: #{feedback.description}
      Type: #{feedback.feedback_type}

      Please do the following:
      1. Acknowledge the #{feedback.feedback_type} in 1-2 sentences.
      2. If it is a bug: suggest the most likely root cause and a fix approach.
         If it is a feature: outline the implementation in 3-5 bullet points.
         If it is an improvement: suggest the simplest way to implement it.
      3. Suggest a git branch name following the convention: #{branch_convention(feedback)}

      Respond concisely. Use plain text, no markdown headers.
    PROMPT
  end

  def branch_convention(feedback)
    case feedback.feedback_type
    when "bug"         then "fix/<short-description>"
    when "feature"     then "feat/<short-description>"
    when "improvement" then "improve/<short-description>"
    else                    "chore/<short-description>"
    end
  end

  def extract_branch_name(text, feedback)
    # Try to pull a branch name from the AI response
    match = text.match(%r{((?:fix|feat|improve|chore)/[\w\-/]+)})
    return match[1] if match

    # Fallback: derive from title
    slug = feedback.title.downcase.gsub(/[^a-z0-9]+/, "-").strip.first(40).chomp("-")
    prefix = feedback.feedback_type == "bug" ? "fix" : "feat"
    "#{prefix}/#{slug}"
  end
end
