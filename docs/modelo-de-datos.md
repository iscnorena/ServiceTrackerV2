# Modelo de datos

> Generado desde `prisma/schema.prisma` con `npm run docs:erd`. No editar a mano.

Multi-tenancy row-level: `Organization` es el límite de aislamiento principal y `Hotel` el segundo. Casi toda entidad operativa lleva `hotelId` para que el scoping sea un filtro directo y no una inferencia por relaciones.

## Diagrama

```mermaid
erDiagram
    Organization {
        String id PK
        String name
        String stripeCustomerId UK
        String stripeSubscriptionId UK
        SubscriptionStatus subscriptionStatus
        DateTime trialEndsAt
        Decimal pricePerHotelSnapshot
        String currencySnapshot
        DateTime cancelledAt
        DateTime trialReminderSentAt
        DateTime createdAt
        DateTime updatedAt
    }
    PlatformConfig {
        String id PK
        Decimal pricePerHotelMonthly
        String currency
        Int trialDays
        Int trialHotelLimit
        String updatedById FK
        DateTime updatedAt
    }
    LegalDocument {
        String id PK
        LegalDocumentType type
        String locale
        LegalDocumentFormat format
        String content
        String fileUrl
        Int version
        String publishedById FK
        DateTime publishedAt
        DateTime createdAt
    }
    GuestReportAttempt {
        String id PK
        String ipHash
        String roomId
        DateTime createdAt
    }
    ProcessedStripeEvent {
        String id PK
        String type
        DateTime processedAt
    }
    Hotel {
        String id PK
        String organizationId FK
        BillingStatus billingStatus
        String name
        String address
        String timezone
        DateTime createdAt
        DateTime updatedAt
    }
    User {
        String id PK
        String name
        String email UK
        String passwordHash
        String organizationId FK
        Boolean isPlatformOwner
        CorporateRole corporateRole
        Boolean canDeleteTickets
        String preferredLocale
        UserStatus status
        DateTime emailVerified
        String image
        DateTime createdAt
        DateTime updatedAt
    }
    UserHotelAccess {
        String id PK
        String userId FK
        String hotelId FK
        PermissionLevel permissionLevel
        String departmentId FK
        Boolean canDeleteTickets
        DateTime createdAt
    }
    AuthToken {
        String id PK
        String userId FK
        AuthTokenType type
        String tokenHash UK
        DateTime expiresAt
        DateTime usedAt
        DateTime createdAt
    }
    Account {
        String id PK
        String userId FK
        String type
        String provider
        String providerAccountId
        String refresh_token
        String access_token
        Int expires_at
        String token_type
        String scope
        String id_token
        String session_state
    }
    Session {
        String id PK
        String sessionToken UK
        String userId FK
        DateTime expires
    }
    VerificationToken {
        String identifier
        String token
        DateTime expires
    }
    Department {
        String id PK
        String hotelId FK
        String name
        Int defaultSlaMinutes
        Boolean affectsRoomStatus
        Boolean active
        String createdById FK
        DateTime createdAt
        DateTime updatedAt
    }
    SupplyItem {
        String id PK
        String hotelId FK
        String name
        String normalizedName
        Boolean active
        String createdById FK
        DateTime createdAt
    }
    Guest {
        String id PK
        String hotelId FK
        String name
        String email
        String phone
        DateTime createdAt
        DateTime updatedAt
    }
    Reservation {
        String id PK
        String hotelId FK
        String guestId FK
        DateTime checkIn
        DateTime checkOut
        String notes
        DateTime createdAt
        DateTime updatedAt
    }
    Room {
        String id PK
        String hotelId FK
        String number
        String floor
        RoomStatus status
    }
    RoomStay {
        String id PK
        String reservationId FK
        String roomId FK
        String contactName
        String contactPhone
        DateTime checkIn
        DateTime checkOut
        DateTime createdAt
        DateTime updatedAt
    }
    Ticket {
        String id PK
        String hotelId FK
        String title
        String description
        String departmentId FK
        TicketStatus status
        TicketPriority priority
        String roomStayId FK
        String assignedToId FK
        String createdById FK
        DateTime slaDueAt
        TicketSource source
        String guestCategory
        DateTime createdAt
        DateTime updatedAt
        DateTime resolvedAt
        DateTime deletedAt
        String deletedById FK
    }
    TicketActivity {
        String id PK
        String ticketId FK
        String userId FK
        TicketActivityAction action
        String detail
        DateTime createdAt
    }
    TicketComment {
        String id PK
        String ticketId FK
        String userId FK
        String message
        DateTime createdAt
    }
    TicketAttachment {
        String id PK
        String ticketId FK
        String uploadedById FK
        String url
        AttachmentType type
        DateTime createdAt
    }
    TicketSupplyUsage {
        String id PK
        String ticketId FK
        String supplyItemId FK
        Int quantity
        DateTime createdAt
    }
    RecurringTicketTemplate {
        String id PK
        String hotelId FK
        String title
        String description
        String departmentId FK
        String roomId FK
        TicketPriority priority
        RecurrenceFrequency frequency
        DateTime nextRunAt
        DateTime lastRunAt
        Boolean active
        String createdById FK
        DateTime createdAt
        DateTime updatedAt
    }
    ShiftNote {
        String id PK
        String hotelId FK
        String departmentId FK
        String authorId FK
        String content
        DateTime createdAt
    }
    User ||--o{ PlatformConfig : "updatedBy"
    User ||--o{ LegalDocument : "publishedBy"
    Organization ||--|{ Hotel : "organization"
    Organization ||--o{ User : "organization"
    User ||--|{ UserHotelAccess : "user"
    Hotel ||--|{ UserHotelAccess : "hotel"
    Department ||--o{ UserHotelAccess : "department"
    User ||--|{ AuthToken : "user"
    User ||--|{ Account : "user"
    User ||--|{ Session : "user"
    Hotel ||--|{ Department : "hotel"
    User ||--o{ Department : "createdBy"
    Hotel ||--|{ SupplyItem : "hotel"
    User ||--o{ SupplyItem : "createdBy"
    Hotel ||--|{ Guest : "hotel"
    Hotel ||--|{ Reservation : "hotel"
    Guest ||--|{ Reservation : "guest"
    Hotel ||--|{ Room : "hotel"
    Reservation ||--|{ RoomStay : "reservation"
    Room ||--|{ RoomStay : "room"
    Hotel ||--|{ Ticket : "hotel"
    Department ||--|{ Ticket : "department"
    RoomStay ||--o{ Ticket : "roomStay"
    User ||--o{ Ticket : "assignedTo"
    User ||--o{ Ticket : "createdBy"
    User ||--o{ Ticket : "deletedBy"
    Ticket ||--|{ TicketActivity : "ticket"
    User ||--o{ TicketActivity : "user"
    Ticket ||--|{ TicketComment : "ticket"
    User ||--o{ TicketComment : "user"
    Ticket ||--|{ TicketAttachment : "ticket"
    User ||--o{ TicketAttachment : "uploadedBy"
    Ticket ||--|{ TicketSupplyUsage : "ticket"
    SupplyItem ||--|{ TicketSupplyUsage : "supplyItem"
    Hotel ||--|{ RecurringTicketTemplate : "hotel"
    Department ||--|{ RecurringTicketTemplate : "department"
    Room ||--o{ RecurringTicketTemplate : "room"
    User ||--o{ RecurringTicketTemplate : "createdBy"
    Hotel ||--|{ ShiftNote : "hotel"
    Department ||--o{ ShiftNote : "department"
    User ||--o{ ShiftNote : "author"
```

## Entidades

| Modelo | Tabla | Para qué existe |
|---|---|---|
| `Organization` | `organizations` | — |
| `PlatformConfig` | `platform_config` | — |
| `LegalDocument` | `legal_documents` | — |
| `GuestReportAttempt` | `guest_report_attempts` | — |
| `ProcessedStripeEvent` | `processed_stripe_events` | — |
| `Hotel` | `hotels` | — |
| `User` | `users` | — |
| `UserHotelAccess` | `user_hotel_access` | — |
| `AuthToken` | `auth_tokens` | — |
| `Account` | `accounts` | — |
| `Session` | `sessions` | — |
| `VerificationToken` | `verification_tokens` | — |
| `Department` | `departments` | — |
| `SupplyItem` | `supply_items` | — |
| `Guest` | `guests` | — |
| `Reservation` | `reservations` | — |
| `Room` | `room` | — |
| `RoomStay` | `room_stays` | — |
| `Ticket` | `tickets` | — |
| `TicketActivity` | `ticket_activities` | — |
| `TicketComment` | `ticket_comments` | — |
| `TicketAttachment` | `ticket_attachments` | — |
| `TicketSupplyUsage` | `ticket_supply_usage` | — |
| `RecurringTicketTemplate` | `recurring_ticket_templates` | — |
| `ShiftNote` | `shift_notes` | — |

## Enums

Todos los enums usan códigos neutrales en inglés. La traducción vive solo en los archivos de mensajes de next-intl: agregar un idioma nunca obliga a traducir lo ya almacenado.

| Enum | Valores |
|---|---|
| `SubscriptionStatus` | `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELLED`, `EXPIRED` |
| `BillingStatus` | `ACTIVE`, `SUSPENDED` |
| `CorporateRole` | `NONE`, `CORPORATE_ADMIN`, `SUPERADMIN` |
| `UserStatus` | `INVITED`, `ACTIVE`, `DISABLED` |
| `PermissionLevel` | `STAFF`, `ADMIN` |
| `AuthTokenType` | `INVITE`, `PASSWORD_RESET` |
| `LegalDocumentType` | `TERMS`, `PRIVACY` |
| `LegalDocumentFormat` | `TEXT`, `PDF` |
| `RoomStatus` | `AVAILABLE`, `OCCUPIED`, `MAINTENANCE` |
| `TicketStatus` | `PENDING`, `IN_PROGRESS`, `RESOLVED`, `CANCELLED` |
| `TicketPriority` | `LOW`, `MEDIUM`, `HIGH` |
| `TicketSource` | `STAFF`, `GUEST` |
| `TicketActivityAction` | `CREATED`, `REASSIGNED`, `STATUS_CHANGED`, `COMMENTED`, `ATTACHED`, `DELETED` |
| `AttachmentType` | `BEFORE`, `AFTER`, `OTHER` |
| `RecurrenceFrequency` | `DAILY`, `WEEKLY`, `MONTHLY` |
