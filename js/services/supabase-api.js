/**
 * Supabase Client & API Service
 * Place this in js/services/supabase-api.js
 * 
 * Add to HTML before other scripts:
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 */

// Initialize Supabase client
const SUPABASE_URL = 'https://lpdzksrvsibtyurpazzs.supabase.co'; // Replace with your project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZHprc3J2c2lidHl1cnBhenpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyODI4MjEsImV4cCI6MjA3Mjg1ODgyMX0.A9quiC44ymRWK0rBX5StZrHvVqFlh1mCaRonaP1PC98'; // Replace with your anon key

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

/**
 * Main API Service
 */
const API = {
  /**
   * Auth methods
   */
  auth: {
    async signUp(email, password, username) {
      try {
        // Check if username is taken
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username)
          .single();
        
        if (existingUser) {
          return { error: { message: 'Username already taken' } };
        }

        // Sign up user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password
        });

        if (authError) return { error: authError };

        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: email,
            username: username
          });

        if (profileError) return { error: profileError };

        return { data: authData };
      } catch (error) {
        return { error };
      }
    },

    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      return { data, error };
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      return { error };
    },

    async getSession() {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    },

    async getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      return profile ? { ...user, profile } : user;
    },

    onAuthStateChange(callback) {
      return supabase.auth.onAuthStateChange(callback);
    }
  },

  /**
   * Profile methods
   */
  profile: {
    async get(userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      return { data, error };
    },

    async update(userId, updates) {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      
      return { data, error };
    }
  },

  /**
   * Draft methods - The core of creation flow
   */
  drafts: {
    async create(priceTier) {
      const user = await API.auth.getUser();
      if (!user) return { error: { message: 'Not authenticated' } };

      const { data, error } = await supabase
        .from('drafts')
        .insert({
          user_id: user.id,
          price_tier: priceTier,
          tier_locked: true,
          current_step: 2
        })
        .select()
        .single();

      return { data, error };
    },

    async get(draftId) {
      const { data, error } = await supabase
        .from('drafts')
        .select(`
          *,
          draft_days (
            *,
            draft_stops (
              *
            )
          )
        `)
        .eq('id', draftId)
        .single();

      // Sort days and stops by their order
      if (data?.draft_days) {
        data.draft_days.sort((a, b) => a.day_number - b.day_number);
        data.draft_days.forEach(day => {
          if (day.draft_stops) {
            day.draft_stops.sort((a, b) => a.position - b.position);
          }
        });
      }

      return { data, error };
    },

    async list(userId) {
      const { data, error } = await supabase
        .from('drafts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_published', false)
        .order('updated_at', { ascending: false });

      return { data, error };
    },

    async update(draftId, updates) {
      // Update draft metadata
      const { data, error } = await supabase
        .from('drafts')
        .update({
          ...updates,
          has_unsaved_changes: false,
          last_saved_at: new Date().toISOString()
        })
        .eq('id', draftId)
        .select()
        .single();

      return { data, error };
    },

async saveComplete(draftId, draftData) {
      // This saves the entire draft including days and stops
      // Used when clicking "Save Draft" button
      
      try {
        console.log('API.drafts.saveComplete called with:', { draftId, draftData });
        
        // Start a transaction-like operation
        const user = await API.auth.getUser();
        if (!user) {
          console.error('No authenticated user');
          throw new Error('Not authenticated');
        }

        // 1. Update draft metadata
        console.log('Updating draft metadata...');
        const { error: draftError } = await supabase
          .from('drafts')
          .update({
            title: draftData.title,
            destination: draftData.destination,
            duration_days: draftData.duration_days,
            description: draftData.description,
            cover_image_url: draftData.cover_image_url,
            current_step: draftData.current_step,
            has_unsaved_changes: false,
            last_saved_at: new Date().toISOString()
          })
          .eq('id', draftId)
          .eq('user_id', user.id);

        if (draftError) {
          console.error('Error updating draft:', draftError);
          throw draftError;
        }
        
        console.log('Draft metadata updated successfully');

        // 2. Delete existing days and stops (easier than complex updates)
        console.log('Deleting existing days...');
        const { error: deleteError } = await supabase
          .from('draft_days')
          .delete()
          .eq('draft_id', draftId);
          
        if (deleteError) {
          console.error('Error deleting days:', deleteError);
          // Continue anyway as there might be no days to delete
        }

        // 3. Insert new days with their stops
        if (draftData.days && draftData.days.length > 0) {
          console.log(`Inserting ${draftData.days.length} days...`);
          
          for (const day of draftData.days) {
            // Insert day
            console.log(`Inserting day ${day.day_number}...`);
            const { data: dayData, error: dayError } = await supabase
              .from('draft_days')
              .insert({
                draft_id: draftId,
                day_number: day.day_number,
                title: day.title || `Day ${day.day_number}`,
                description: day.description || ''
              })
              .select()
              .single();

            if (dayError) {
              console.error(`Error inserting day ${day.day_number}:`, dayError);
              throw dayError;
            }
            
            console.log(`Day ${day.day_number} inserted with ID:`, dayData.id);

            // Insert stops for this day
            const stops = day.stops || [];
            if (stops.length > 0) {
              console.log(`Inserting ${stops.length} stops for day ${day.day_number}...`);
              
              const stopsToInsert = stops.map((stop, index) => ({
                draft_day_id: dayData.id,
                position: index + 1,
                name: stop.name || '',
                type: stop.type || 'attraction',
                tip: stop.tip || '',
                time_period: stop.time_period || null,
                location: stop.location || null,
                start_time: stop.start_time || null,
                duration_minutes: stop.duration_minutes || null,
                cost_cents: stop.cost_cents || null,
                description: stop.description || null,
                link: stop.link || null,
                lat: stop.lat || null,
                lng: stop.lng || null
              }));

              const { error: stopsError } = await supabase
                .from('draft_stops')
                .insert(stopsToInsert);

              if (stopsError) {
                console.error(`Error inserting stops for day ${day.day_number}:`, stopsError);
                throw stopsError;
              }
              
              console.log(`${stops.length} stops inserted for day ${day.day_number}`);
            }
          }
        }
        
        console.log('Draft saved successfully!');
        return { data: { success: true }, error: null };
        
      } catch (error) {
        console.error('SaveComplete error:', error);
        return { data: null, error };
      }
    },

    async delete(draftId) {
      const { error } = await supabase
        .from('drafts')
        .delete()
        .eq('id', draftId);

      return { error };
    },

    async publish(draftId) {
      // Call the publish_draft function we defined in SQL
      const { data, error } = await supabase
        .rpc('publish_draft', { draft_id_input: draftId });

      if (error) return { error };

      return { data: { itinerary_id: data } };
    }
  },

  /**
   * Draft Days methods
   */
  draftDays: {
    async create(draftId, dayData) {
      const { data, error } = await supabase
        .from('draft_days')
        .insert({
          draft_id: draftId,
          ...dayData
        })
        .select()
        .single();

      return { data, error };
    },

    async update(dayId, updates) {
      const { data, error } = await supabase
        .from('draft_days')
        .update(updates)
        .eq('id', dayId)
        .select()
        .single();

      return { data, error };
    },

    async delete(dayId) {
      const { error } = await supabase
        .from('draft_days')
        .delete()
        .eq('id', dayId);

      return { error };
    }
  },

  /**
   * Draft Stops methods
   */
  draftStops: {
    async create(dayId, stopData) {
      const { data, error } = await supabase
        .from('draft_stops')
        .insert({
          draft_day_id: dayId,
          ...stopData
        })
        .select()
        .single();

      return { data, error };
    },

    async update(stopId, updates) {
      const { data, error } = await supabase
        .from('draft_stops')
        .update(updates)
        .eq('id', stopId)
        .select()
        .single();

      return { data, error };
    },

    async delete(stopId) {
      const { error } = await supabase
        .from('draft_stops')
        .delete()
        .eq('id', stopId);

      return { error };
    },

    async reorder(dayId, stopIds) {
      // Update positions for all stops in order
      try {
        for (let i = 0; i < stopIds.length; i++) {
          const { error } = await supabase
            .from('draft_stops')
            .update({ position: i + 1 })
            .eq('id', stopIds[i]);
          
          if (error) throw error;
        }
        return { error: null };
      } catch (error) {
        return { error };
      }
    }
  },

  /**
   * Itineraries methods (published)
   */
  itineraries: {
    async list(filters = {}) {
      let query = supabase
        .from('itineraries')
        .select(`
          *,
          creator:profiles!itineraries_creator_id_fkey(
            username,
            avatar_url
          )
        `);

      // Apply filters
      if (filters.creator_id) {
        query = query.eq('creator_id', filters.creator_id);
      }
      if (filters.destination) {
        query = query.ilike('destination', `%${filters.destination}%`);
      }
      if (filters.min_duration) {
        query = query.gte('duration_days', filters.min_duration);
      }
      if (filters.max_duration) {
        query = query.lte('duration_days', filters.max_duration);
      }
      if (filters.price_tier) {
        query = query.eq('price_tier', filters.price_tier);
      }

      // Sorting
      const sortBy = filters.sort_by || 'published_at';
      const ascending = filters.sort_order === 'asc';
      query = query.order(sortBy, { ascending });

      // Pagination
      const page = filters.page || 1;
      const limit = filters.limit || 12;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error } = await query;
      return { data, error };
    },

    async get(itineraryId) {
      const { data, error } = await supabase
        .from('itineraries')
        .select(`
          *,
          creator:profiles!itineraries_creator_id_fkey(
            username,
            avatar_url,
            bio
          )
        `)
        .eq('id', itineraryId)
        .single();

      return { data, error };
    },

    async incrementView(itineraryId) {
      const { error } = await supabase.rpc('increment', {
        table_name: 'itineraries',
        row_id: itineraryId,
        column_name: 'view_count'
      });
      return { error };
    }
  },

  /**
   * Wishlist methods
   */
  wishlist: {
    async add(itineraryId) {
      const user = await API.auth.getUser();
      if (!user) return { error: { message: 'Not authenticated' } };

      const { error } = await supabase
        .from('wishlists')
        .insert({
          user_id: user.id,
          itinerary_id: itineraryId
        });

      return { error };
    },

    async remove(itineraryId) {
      const user = await API.auth.getUser();
      if (!user) return { error: { message: 'Not authenticated' } };

      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', user.id)
        .eq('itinerary_id', itineraryId);

      return { error };
    },

    async list(userId) {
      const { data, error } = await supabase
        .from('wishlists')
        .select(`
          itinerary_id,
          added_at,
          itinerary:itineraries(
            *,
            creator:profiles!itineraries_creator_id_fkey(
              username,
              avatar_url
            )
          )
        `)
        .eq('user_id', userId)
        .order('added_at', { ascending: false });

      return { data, error };
    },

    async check(itineraryId) {
      const user = await API.auth.getUser();
      if (!user) return { data: false };

      const { data, error } = await supabase
        .from('wishlists')
        .select('itinerary_id')
        .eq('user_id', user.id)
        .eq('itinerary_id', itineraryId)
        .single();

      return { data: !!data, error };
    }
  },

  /**
   * Storage methods for images
   */
  storage: {
    async uploadCoverImage(file, draftId) {
      const user = await API.auth.getUser();
      if (!user) return { error: { message: 'Not authenticated' } };

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${draftId}/cover.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('covers')
        .upload(fileName, file, {
          upsert: true
        });

      if (error) return { error };

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('covers')
        .getPublicUrl(fileName);

      return { data: { url: publicUrl }, error: null };
    }
  }
};

// Make API available globally
window.API = API;