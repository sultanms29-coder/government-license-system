# الإصدار 27.0.0 — Enterprise Foundation

تم تنفيذ المرحلة الأولى لتوحيد البنية السحابية:

- استبدال jsonbin.io في نظام الصادر والوارد بـ Supabase Realtime.
- استبدال jsonbin.io في نظام الغرامات والمخالفات بـ Supabase Realtime.
- استخدام جدول app_state نفسه مع Workspace مستقل لكل نظام لمنع تعارض البيانات.
- مشاركة رابط Supabase والمفتاح العام تلقائياً مع بقية أنظمة المنصة على الجهاز نفسه.
- مزامنة لحظية واستعادة تلقائية عند عودة الاتصال.
- المحافظة على البيانات المحلية الحالية وعدم حذفها عند الترقية.

مساحات العمل:
- alandiyah-correspondence
- alandiyah-violations

يلزم تنفيذ ملف ENTERPRISE_SCHEMA_AND_RLS.sql في مشروع Supabase مرة واحدة إذا لم يُنفذ سابقاً.
