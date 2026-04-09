class Link < ApplicationRecord
  SOURCE_TYPES = %w[youtube twitter article docs github website other].freeze

  belongs_to :project
  belongs_to :task, optional: true

  before_validation :normalize_url
  before_validation :infer_source_type, if: -> { source_type.blank? || source_type == "other" }

  validates :url, presence: true
  validates :project, presence: true
  validates :source_type, inclusion: { in: SOURCE_TYPES }
  validate :task_belongs_to_project

  scope :recent_first, -> { order(created_at: :desc) }
  scope :for_project, ->(project_id) { where(project_id: project_id) }
  scope :for_task, ->(task_id) { where(task_id: task_id) }

  private

  def normalize_url
    self.url = url.to_s.strip
  end

  def infer_source_type
    candidate = url.to_s.downcase
    self.source_type =
      if candidate.include?("youtube.com") || candidate.include?("youtu.be")
        "youtube"
      elsif candidate.include?("twitter.com") || candidate.include?("x.com")
        "twitter"
      elsif candidate.include?("github.com")
        "github"
      else
        "other"
      end
  end

  def task_belongs_to_project
    return if task.blank? || project.blank?
    return if task.project_id == project.id

    errors.add(:task_id, "must belong to the same project as the link")
  end
end
