# Streams project-scoped task changes so ProjectDetailPage refreshes automatically
class ProjectUpdatesChannel < ApplicationCable::Channel
  def subscribed
    if params[:project_id].present?
      stream_from "project_updates:#{params[:project_id]}"
    else
      reject
    end
  end

  def unsubscribed
    stop_all_streams
  end
end
