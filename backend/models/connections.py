from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base
import uuid
from datetime import datetime

class PlatformConnection(Base):
    __tablename__ = "platform_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    platform = Column(String(50), nullable=False)
    page_id = Column(String(100), nullable=True)
    page_name = Column(String(255), nullable=True)
    page_username = Column(String(100), nullable=True)
    follower_count = Column(Integer, default=0)
    
    # Encrypted token storage
    access_token_encrypted = Column(Text, nullable=True)
    refresh_token_encrypted = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    
    # Connection metadata
    is_active = Column(Boolean, default=True)
    last_sync = Column(DateTime, nullable=True)
    last_posted_at = Column(DateTime, nullable=True)
    connection_status = Column(String(20), default='active')  # active, expired, revoked, error
    
    # Timestamps
    connected_at = Column(DateTime, default=datetime.utcnow)
    last_token_refresh = Column(DateTime, nullable=True)
    disconnected_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    settings = relationship("PlatformSettings", back_populates="connection", uselist=False, cascade="all, delete-orphan")
    activities = relationship("ConnectionActivity", back_populates="connection", cascade="all, delete-orphan")

class PlatformSettings(Base):
    __tablename__ = "platform_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connection_id = Column(UUID(as_uuid=True), ForeignKey("platform_connections.id"), nullable=False)
    auto_posting = Column(Boolean, default=True)
    default_posting_time = Column(String(10), nullable=True)  # Format: "HH:MM"
    timezone = Column(String(50), default="UTC")
    post_frequency = Column(Integer, default=1)  # Posts per day
    content_preferences = Column(JSON, nullable=True)  # hashtags, emojis, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    connection = relationship("PlatformConnection", back_populates="settings")

class TokenRefreshQueue(Base):
    __tablename__ = "token_refresh_queue"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connection_id = Column(UUID(as_uuid=True), ForeignKey("platform_connections.id"), nullable=False)
    platform = Column(String(50), nullable=False)
    refresh_attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    next_attempt_at = Column(DateTime, nullable=True)
    status = Column(String(20), default='pending')  # pending, processing, completed, failed
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    connection = relationship("PlatformConnection")

class ConnectionActivity(Base):
    __tablename__ = "connection_activity"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connection_id = Column(UUID(as_uuid=True), ForeignKey("platform_connections.id"), nullable=False)
    activity_type = Column(String(50), nullable=False)  # connect, refresh, post, error, disconnect
    status = Column(String(20), nullable=False)  # success, error, warning
    message = Column(Text, nullable=True)
    metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    connection = relationship("PlatformConnection", back_populates="activities")

class OAuthState(Base):
    __tablename__ = "oauth_states"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    platform = Column(String(50), nullable=False)
    state = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
