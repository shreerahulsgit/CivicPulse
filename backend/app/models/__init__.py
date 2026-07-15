# models package
#
# Import all models here so that:
#   1. Base.metadata discovers every table for create_all / Alembic.
#   2. SQLAlchemy resolves all string-based relationship() references.
#
# Every new model must be imported here.

from app.models.user import User, UserRole, AuthProvider               # noqa: F401
from app.models.category import Category                                # noqa: F401
from app.models.location import Location                                # noqa: F401
from app.models.complaint import Complaint, ComplaintStatus             # noqa: F401
from app.models.complaint_image import ComplaintImage                   # noqa: F401
from app.models.complaint_status_history import ComplaintStatusHistory  # noqa: F401
from app.models.complaint_progress_update import ComplaintProgressUpdate        # noqa: F401
from app.models.complaint_resolution_image import ComplaintResolutionImage, ResolutionImageType  # noqa: F401
from app.models.complaint_embedding import ComplaintEmbedding           # noqa: F401
from app.models.department import Department                            # noqa: F401
from app.models.jurisdiction import Jurisdiction, JurisdictionType      # noqa: F401
from app.models.ward import Ward                                        # noqa: F401
from app.models.officer_assignment import OfficerAssignment             # noqa: F401
from app.models.notification import Notification, NotificationType      # noqa: F401
from app.models.notification_preference import NotificationPreference   # noqa: F401
from app.models.complaint_escalation import ComplaintEscalation         # noqa: F401
from app.models.zone import Zone                                        # noqa: F401
from app.models.zone_department import ZoneDepartment                   # noqa: F401
from app.models.ward_geometry import WardGeometry                       # noqa: F401
from app.models.zone_forum import ZoneForumMessage                      # noqa: F401
from app.models.complaint_feedback import ComplaintFeedback             # noqa: F401
