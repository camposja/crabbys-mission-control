class OpsNote < ApplicationRecord
  STATUSES = %w[active archived].freeze
  FORMATS  = %w[plain markdown].freeze

  before_validation :set_slug, if: -> { slug.blank? && title.present? }
  before_validation :normalize_tags
  before_validation :normalize_source_links

  validates :title, presence: true
  validates :slug, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :notes_format, inclusion: { in: FORMATS }
  validate  :validate_source_links_shape
  validate  :require_core_fields

  scope :recent,      -> { order(Arel.sql("pinned DESC, last_used_at DESC NULLS LAST, updated_at DESC")) }
  scope :pinned_only, -> { where(pinned: true) }
  scope :by_category, ->(category) { where(category: category) }
  scope :by_tag, ->(tag) {
    where("tags @> ?::jsonb", [tag].to_json)
  }
  scope :search, ->(query) {
    where("title ILIKE :q OR body ILIKE :q OR command_snippet ILIKE :q", q: "%#{query}%")
  }

  private

  def set_slug
    base = title.to_s.parameterize
    candidate = base
    n = 2
    while self.class.where.not(id: id).exists?(slug: candidate)
      candidate = "#{base}-#{n}"
      n += 1
    end
    self.slug = candidate
  end

  def normalize_tags
    self.tags = Array(tags).map(&:to_s).map(&:strip).reject(&:blank?).uniq
  end

  def normalize_source_links
    self.source_links = Array(source_links).map do |item|
      item.to_h.stringify_keys.slice("label", "url", "source_type")
    end.reject { |item| item.values.all?(&:blank?) }
  end

  def validate_source_links_shape
    Array(source_links).each do |link|
      unless link.is_a?(Hash)
        errors.add(:source_links, "must be an array of objects")
        next
      end

      data = link.stringify_keys
      next if data.values.all?(&:blank?)

      if data["url"].present? && data["url"] !~ URI::DEFAULT_PARSER.make_regexp(%w[http https])
        errors.add(:source_links, "urls must be valid http/https links")
      end
    end
  end

  def require_core_fields
    errors.add(:category, "can't be blank") if category.blank?
    errors.add(:command_snippet, "can't be blank") if command_snippet.blank?
  end
end
