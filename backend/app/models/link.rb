class Link < ApplicationRecord
  SOURCE_TYPES = %w[youtube twitter article docs github website other].freeze

  # Legacy owners (unchanged): project/task links still set project_id.
  belongs_to :project, optional: true
  belongs_to :task, optional: true
  # New reusable owner: Course / CourseUnit links set `linkable` instead of project.
  belongs_to :linkable, polymorphic: true, optional: true

  before_validation :normalize_url
  before_validation :infer_source_type, if: -> { source_type.blank? || source_type == "other" }

  validates :url, presence: true
  validates :source_type, inclusion: { in: SOURCE_TYPES }
  # Scoped per polymorphic owner; only meaningful for linkable-owned (course/unit) links.
  validates :external_id, uniqueness: { scope: [:linkable_type, :linkable_id], allow_nil: true }
  validate :must_have_owner
  validate :task_belongs_to_project

  scope :recent_first, -> { order(created_at: :desc) }
  scope :for_project, ->(project_id) { where(project_id: project_id) }
  scope :for_task, ->(task_id) { where(task_id: task_id) }
  scope :for_linkable, ->(type, id) { where(linkable_type: type, linkable_id: id) }

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

  # A link must belong to either a legacy project (project/task links) or a
  # polymorphic owner (course/unit links). Preserves the old "project required"
  # guarantee for the legacy path without blocking the new path.
  def must_have_owner
    return if project.present? || linkable.present?

    errors.add(:base, "must belong to a project or a linkable owner")
  end

  def task_belongs_to_project
    return if task.blank? || project.blank?
    return if task.project_id == project.id

    errors.add(:task_id, "must belong to the same project as the link")
  end
end
