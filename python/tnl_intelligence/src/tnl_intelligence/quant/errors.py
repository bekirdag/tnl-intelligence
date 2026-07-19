class QuantError(Exception):
    """Base error for quantitative research workflows."""


class TemporalIntegrityError(QuantError, ValueError):
    """Raised when a timestamp or point-in-time boundary is ambiguous."""


class RevisionCollisionError(QuantError):
    """Raised when an immutable revision identifier has different content."""


class MissingOptionalDependency(QuantError, ImportError):
    def __init__(self, package: str, extra: str) -> None:
        super().__init__(
            f"{package} is required for this operation; install tnl-intelligence[{extra}]"
        )
        self.package = package
        self.extra = extra
