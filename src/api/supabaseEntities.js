import { supabase } from '@/lib/supabaseClient';

// Adattatore che imita l'interfaccia di base44.entities (.filter, .list, .get)
// così le pagine esistenti richiedono modifiche minime durante la migrazione
// progressiva da Base44 a Supabase. Una volta spostate tutte le pagine, questo
// file può sostituire del tutto base44Client.js.

function applyFilters(qb, query) {
  for (const [key, val] of Object.entries(query || {})) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if ('$in' in val) qb = qb.in(key, val.$in);
      if ('$gte' in val) qb = qb.gte(key, val.$gte);
      if ('$lte' in val) qb = qb.lte(key, val.$lte);
      if ('$gt' in val) qb = qb.gt(key, val.$gt);
      if ('$lt' in val) qb = qb.lt(key, val.$lt);
    } else {
      qb = qb.eq(key, val);
    }
  }
  return qb;
}

function applySort(qb, sort) {
  if (!sort) return qb;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  return qb.order(field, { ascending: !desc });
}

function makeEntity(table) {
  return {
    async filter(query = {}, sort, limit) {
      let qb = supabase.from(table).select('*');
      qb = applyFilters(qb, query);
      qb = applySort(qb, sort);
      if (limit) qb = qb.limit(limit);
      const { data, error } = await qb;
      if (error) {
        console.error(`[supabase] ${table}.filter`, error);
        return [];
      }
      return data || [];
    },
    list(sort, limit) {
      return this.filter({}, sort, limit);
    },
    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) {
        console.error(`[supabase] ${table}.get`, error);
        return null;
      }
      return data;
    },
    async create(payload) {
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) {
        console.error(`[supabase] ${table}.create`, error);
        throw error;
      }
      return data;
    },
    async update(id, payload) {
      const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
      if (error) {
        console.error(`[supabase] ${table}.update`, error);
        throw error;
      }
      return data;
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) {
        console.error(`[supabase] ${table}.delete`, error);
        throw error;
      }
      return true;
    }
  };
}

export const sb44 = {
  entities: {
    Post: makeEntity('posts'),
    Event: makeEntity('events'),
    Testata: makeEntity('testate'),
    PollEntry: makeEntity('poll_entries'),
    CoalitionGroup: makeEntity('coalition_groups'),
    SocialLink: makeEntity('social_links'),
    SiteContent: makeEntity('site_content'),
    SplashConfig: makeEntity('splash_config'),
    StoryShareConfig: makeEntity('story_share_config'),
    UxConfig: makeEntity('ux_config'),
    EmailTemplate: makeEntity('email_templates'),
    NewsletterSubscriber: makeEntity('newsletter_subscribers'),
    SavedArticle: makeEntity('saved_articles'),
    SavedEvent: makeEntity('saved_events'),
    FavoriteSource: makeEntity('favorite_sources'),
    EventRegistration: makeEntity('event_registrations'),
    RateLimit: makeEntity('rate_limits'),
    ExecutionLog: makeEntity('execution_logs')
  }
};
