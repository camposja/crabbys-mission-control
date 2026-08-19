# Path containment helpers.
#
# The naive check is `real.start_with?(root)`, which lets a SIBLING directory
# through: "/Users/me/.openclaw-evil/x" starts with "/Users/me/.openclaw". Every
# containment test here compares against "root" or "root/" so a sibling whose
# name merely begins with the root's name cannot match, and callers resolve
# symlinks first so a link pointing outside the root is judged by its target.
module SafePath
  class OutsideRoot < StandardError; end

  # Is +path+ the root itself, or something beneath it?
  # Both arguments must already be absolute and symlink-resolved.
  def self.contained?(path, root)
    p = path.to_s.chomp(File::SEPARATOR)
    r = root.to_s.chomp(File::SEPARATOR)
    return false if p.empty? || r.empty?

    p == r || p.start_with?(r + File::SEPARATOR)
  end

  # Resolve +path+ (following symlinks) and require the result to sit inside
  # +root+. Raises rather than returning something the caller might use anyway.
  #
  # @raise [OutsideRoot] traversal, sibling-prefix or symlink escape
  # @raise [Errno::ENOENT] the path does not exist
  def self.realpath_within!(path, root)
    real_root = File.realpath(root)
    real      = File.realpath(path)
    raise OutsideRoot, "Access denied" unless contained?(real, real_root)

    real
  end

  # A filename safe to write into a directory: no separators, no traversal, no
  # dotfiles, no control characters. Returns nil when nothing usable is left.
  def self.sanitized_basename(name)
    base = File.basename(name.to_s.strip)
    base = base.gsub(/[^\w.\-]/, "_")   # separators and exotic characters out
    base = base.sub(/\A\.+/, "")        # no "..", no ".", no hidden files
    return nil if base.empty? || base.delete(".").empty?

    base
  end

  # Build a destination path under +root+ and prove it stays there. The target
  # need not exist yet, so this expands rather than resolving symlinks; +root+
  # itself is resolved.
  #
  # @raise [OutsideRoot] the joined path would escape +root+
  def self.join_within!(root, name)
    real_root = File.realpath(root)
    path      = File.expand_path(File.join(real_root, name))
    raise OutsideRoot, "Access denied" unless contained?(path, real_root)

    path
  end
end
