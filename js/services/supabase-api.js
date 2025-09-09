/**
 * Supabase Client & API Service
 * Place this in js/services/supabase-api.js
 * 
 * Add to HTML before other scripts:
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 */

// Initialize Supabase client
const SUPABASE_URL = 'https://lpdzksrvsibtyurpazzs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZHprc3J2c2lidHl1cnBhenpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyODI4MjEsImV4cCI6MjA3Mjg1ODgyMX0.A9quiC44ymRWK0rBX5StZrHvVqFlh1mCaRonaP1PC98';

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
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        // Get profile data
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          return user; // Return user without profile if profile fetch fails
        }

        return profile ? { ...user, ...profile, id: user.id } : user;
      } catch (error) {
        console.error('Error in getUser:', error);
        return null;
      }
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
      try {
        // First verify the user is authenticated
        const user = await API.auth.getUser();
        if (!user) {
          return { data: null, error: { message: 'Not authenticated', code: '401' } };
        }
        
        // Query with user_id check to ensure ownership
        const { data, error } = await supabase
          .from('drafts')
          .select(`
            *,
            draft_days (
              *,
              draft_stops (
                *
              )
            ),
            draft_characteristics (*),
            draft_transportation (*),
            draft_accommodation (*),
            draft_travel_tips (*)
          `)
          .eq('id', draftId)
          .eq('user_id', user.id) // Ensure draft belongs to user
          .single();

        if (error) {
          console.error('Error fetching draft:', error);
          return { data: null, error };
        }

        if (!data) {
          return { data: null, error: { message: 'Draft not found or access denied', code: '404' } };
        }

        // Sort days and stops by their order
        if (data?.draft_days) {
          data.draft_days.sort((a, b) => a.day_number - b.day_number);
          data.draft_days.forEach(day => {
            if (day.draft_stops) {
              day.draft_stops.sort((a, b) => a.position - b.position);
            }
          });
        }

        return { data, error: null };
      } catch (err) {
        console.error('Error in drafts.get:', err);
        return { data: null, error: err };
      }
    },

/**
 * REPLACE the getPreview method in your API.drafts object with this:
 */

async getPreview(draftId) {
  try {
    const user = await API.auth.getUser();
    if (!user) {
      return { data: null, error: { message: 'Not authenticated' } };
    }

    const { data, error } = await supabase
      .from('drafts')
      .select(`
        *,
        draft_days (
          *,
          draft_stops (*)
        ),
        draft_characteristics (*),
        draft_transportation (*),
        draft_accommodation (*),
        draft_travel_tips (*)
      `)
      .eq('id', draftId)
      .eq('user_id', user.id)
      .single();
    
    if (error) {
      console.error('Error fetching draft preview:', error);
      return { data: null, error };
    }
    
    if (data) {
      // Sort days and stops
      if (data.draft_days) {
        data.draft_days.sort((a, b) => a.day_number - b.day_number);
        data.draft_days.forEach(day => {
          if (day.draft_stops) {
            day.draft_stops.sort((a, b) => a.position - b.position);
          }
        });
      }
      
      // Transform to preview format - DIRECTLY USE THE CHARACTERISTICS ARRAY
      const transformedData = {
        ...data,
        days: data.draft_days?.map(day => ({
          ...day,
          stops: day.draft_stops || []
        })) || [],
        
        // SIMPLE FIX: Pull directly from the characteristics array
        physical_demand: data.draft_characteristics?.[0]?.physical_demand || null,
        cultural_immersion: data.draft_characteristics?.[0]?.cultural_immersion || null,
        pace: data.draft_characteristics?.[0]?.pace || null,
        budget_level: data.draft_characteristics?.[0]?.budget_level || null,
        social_style: data.draft_characteristics?.[0]?.social_style || null,
        
        // Keep nested format for compatibility
        characteristics: data.draft_characteristics?.[0] || null,
        transportation: data.draft_transportation?.[0] || null,
        accommodation: data.draft_accommodation?.[0] || null,
        travel_tips: data.draft_travel_tips?.[0] || null
      };
      
      return {
        data: transformedData,
        error: null
      };
    }
    
    return { data: null, error: { message: 'Draft not found' } };
  } catch (err) {
    console.error('Error in drafts.getPreview:', err);
    return { data: null, error: err };
  }
},

    async list(userId) {
      if (!userId) {
        const user = await API.auth.getUser();
        if (!user) return { data: [], error: { message: 'Not authenticated' } };
        userId = user.id;
      }
      
      const { data, error } = await supabase
        .from('drafts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_published', false)
        .order('updated_at', { ascending: false });

      return { data: data || [], error };
    },

    async update(draftId, updates) {
      const user = await API.auth.getUser();
      if (!user) return { error: { message: 'Not authenticated' } };
      
      // Update draft metadata INCLUDING LOCATION FIELDS
      const { data, error } = await supabase
        .from('drafts')
        .update({
          ...updates,
          // Include location fields if present
          place_id: updates.place_id !== undefined ? updates.place_id : undefined,
          country: updates.country !== undefined ? updates.country : undefined,
          country_code: updates.country_code !== undefined ? updates.country_code : undefined,
          region: updates.region !== undefined ? updates.region : undefined,
          city: updates.city !== undefined ? updates.city : undefined,
          lat: updates.lat !== undefined ? updates.lat : undefined,
          lng: updates.lng !== undefined ? updates.lng : undefined,
          has_unsaved_changes: false,
          last_saved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', draftId)
        .eq('user_id', user.id) // Ensure ownership
        .select()
        .single();

      return { data, error };
    },

    async saveComplete(draftId, draftData) {
      // This saves the entire draft including days and stops
      // OPTIMIZED: Uses batch inserts instead of individual calls
      
      try {
        console.log('API.drafts.saveComplete called with:', { draftId, draftData });
        
        // Start a transaction-like operation
        const user = await API.auth.getUser();
        if (!user) {
          console.error('No authenticated user');
          throw new Error('Not authenticated');
        }

        // 1. Update draft metadata INCLUDING LOCATION FIELDS
        console.log('Updating draft metadata...');
        const { error: draftError } = await supabase
          .from('drafts')
          .update({
            title: draftData.title,
            destination: draftData.destination,
            duration_days: draftData.duration_days,
            description: draftData.description,
            cover_image_url: draftData.cover_image_url,
            // ADD LOCATION FIELDS
            place_id: draftData.place_id || null,
            country: draftData.country || null,
            country_code: draftData.country_code || null,
            region: draftData.region || null,
            city: draftData.city || null,
            lat: draftData.lat || null,
            lng: draftData.lng || null,
            current_step: draftData.current_step,
            has_unsaved_changes: false,
            last_saved_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
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
        await supabase
          .from('draft_days')
          .delete()
          .eq('draft_id', draftId);

        // 3. Batch insert all days at once
        if (draftData.days && draftData.days.length > 0) {
          console.log(`Batch inserting ${draftData.days.length} days...`);
          
          // Prepare all days for batch insert
          const daysToInsert = draftData.days.map(day => ({
            draft_id: draftId,
            day_number: day.day_number,
            title: day.title || `Day ${day.day_number}`,
            description: day.description || ''
          }));

          // Batch insert all days at once
          const { data: insertedDays, error: daysError } = await supabase
            .from('draft_days')
            .insert(daysToInsert)
            .select();

          if (daysError) {
            console.error('Error batch inserting days:', daysError);
            throw daysError;
          }

          console.log(`${insertedDays.length} days inserted successfully`);

          // 4. Prepare and batch insert all stops at once
          const allStopsToInsert = [];
          
          draftData.days.forEach((day, dayIndex) => {
            const insertedDay = insertedDays[dayIndex];
            if (insertedDay && day.stops && day.stops.length > 0) {
              const stopsForDay = day.stops.map((stop, stopIndex) => ({
                draft_day_id: insertedDay.id,
                position: stopIndex + 1,
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
                lng: stop.lng || null,
                // ADD PLACE FIELDS FOR STOPS
                place_id: stop.place_id || null,
                formatted_address: stop.formatted_address || null
              }));
              
              allStopsToInsert.push(...stopsForDay);
            }
          });

          // Batch insert all stops at once if there are any
          if (allStopsToInsert.length > 0) {
            console.log(`Batch inserting ${allStopsToInsert.length} stops...`);
            
            const { error: stopsError } = await supabase
              .from('draft_stops')
              .insert(allStopsToInsert);

            if (stopsError) {
              console.error('Error batch inserting stops:', stopsError);
              throw stopsError;
            }
            
            console.log(`${allStopsToInsert.length} stops inserted successfully`);
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
      const user = await API.auth.getUser();
      if (!user) return { error: { message: 'Not authenticated' } };
      
      const { error } = await supabase
        .from('drafts')
        .delete()
        .eq('id', draftId)
        .eq('user_id', user.id); // Ensure ownership

      return { error };
    },

    async publish(draftId) {
      const user = await API.auth.getUser();
      if (!user) return { error: { message: 'Not authenticated' } };
      
      // Call the publish_draft function we defined in SQL
      const { data, error } = await supabase
        .rpc('publish_draft', { draft_id_input: draftId });

      if (error) return { error };

      return { data: { itinerary_id: data } };
    },

    // STEP 3 METHODS
    async getCharacteristics(draftId) {
      const { data, error } = await supabase
        .from('draft_characteristics')
        .select('*')
        .eq('draft_id', draftId)
        .single();
      return { data, error };
    },

    async saveCharacteristics(draftId, characteristics) {
      // Upsert characteristics
      const { data, error } = await supabase
        .from('draft_characteristics')
        .upsert({
          draft_id: draftId,
          physical_demand: characteristics.physical_demand,
          cultural_immersion: characteristics.cultural_immersion,
          pace: characteristics.pace,
          budget_level: characteristics.budget_level,
          social_style: characteristics.social_style,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'draft_id'
        })
        .select()
        .single();
      
      // Mark characteristics as completed in drafts table
      if (!error) {
        await supabase
          .from('drafts')
          .update({ 
            characteristics_completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', draftId);
      }
      
      return { data, error };
    },

    async getTransportation(draftId) {
      const { data, error } = await supabase
        .from('draft_transportation')
        .select('*')
        .eq('draft_id', draftId)
        .single();
      return { data, error };
    },

    async saveTransportation(draftId, transportation) {
      const { data, error } = await supabase
        .from('draft_transportation')
        .upsert({
          draft_id: draftId,
          getting_there: transportation.getting_there || null,
          getting_around: transportation.getting_around || null,
          local_transport_tips: transportation.local_transport_tips || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'draft_id'
        })
        .select()
        .single();
      
      return { data, error };
    },

    async getAccommodation(draftId) {
      const { data, error } = await supabase
        .from('draft_accommodation')
        .select('*')
        .eq('draft_id', draftId)
        .single();
      return { data, error };
    },

    async saveAccommodation(draftId, accommodation) {
      const { data, error } = await supabase
        .from('draft_accommodation')
        .upsert({
          draft_id: draftId,
          area_recommendations: accommodation.area_recommendations || null,
          booking_tips: accommodation.booking_tips || null,
          hotel_suggestions: accommodation.hotel_suggestions || [],
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'draft_id'
        })
        .select()
        .single();
      
      return { data, error };
    },

    async getTravelTips(draftId) {
      const { data, error } = await supabase
        .from('draft_travel_tips')
        .select('*')
        .eq('draft_id', draftId)
        .single();
      return { data, error };
    },

    async saveTravelTips(draftId, tips) {
      const { data, error } = await supabase
        .from('draft_travel_tips')
        .upsert({
          draft_id: draftId,
          best_time_to_visit: tips.best_time_to_visit || null,
          visa_requirements: tips.visa_requirements || null,
          packing_suggestions: tips.packing_suggestions || null,
          budget_breakdown: tips.budget_breakdown || null,
          other_tips: tips.other_tips || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'draft_id'
        })
        .select()
        .single();
      
      return { data, error };
    },

    async getAllEssentials(draftId) {
      const [transport, accommodation, tips] = await Promise.all([
        this.getTransportation(draftId),
        this.getAccommodation(draftId),
        this.getTravelTips(draftId)
      ]);
      
      return {
        transportation: transport.data,
        accommodation: accommodation.data,
        travel_tips: tips.data,
        has_any: !!(transport.data || accommodation.data || tips.data)
      };
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
          // Include place fields if present
          place_id: stopData.place_id || null,
          formatted_address: stopData.formatted_address || null,
          ...stopData
        })
        .select()
        .single();

      return { data, error };
    },

    async update(stopId, updates) {
      const { data, error } = await supabase
        .from('draft_stops')
        .update({
          // Include place fields if present in updates
          place_id: updates.place_id !== undefined ? updates.place_id : undefined,
          formatted_address: updates.formatted_address !== undefined ? updates.formatted_address : undefined,
          ...updates
        })
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
      
      // LOCATION FILTERS
      if (filters.country_code) {
        query = query.eq('country_code', filters.country_code);
      }
      if (filters.country) {
        query = query.ilike('country', `%${filters.country}%`);
      }
      if (filters.city) {
        query = query.ilike('city', `%${filters.city}%`);
      }
      
      // SEARCH FILTER (searches multiple fields)
      if (filters.search) {
        query = query.or(`destination.ilike.%${filters.search}%,title.ilike.%${filters.search}%,country.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
      }
      
      // Legacy destination filter (keep for backward compatibility)
      if (filters.destination) {
        query = query.ilike('destination', `%${filters.destination}%`);
      }
      
      // Duration filters
      if (filters.min_duration) {
        query = query.gte('duration_days', filters.min_duration);
      }
      if (filters.max_duration) {
        query = query.lte('duration_days', filters.max_duration);
      }
      
      // Price filter
      if (filters.price_tier) {
        query = query.eq('price_tier', filters.price_tier);
      }
      
      // CHARACTERISTIC FILTERS
      if (filters.physical_demand) {
        query = query.eq('characteristics->>physical_demand', filters.physical_demand);
      }
      if (filters.budget_level) {
        query = query.eq('characteristics->>budget_level', filters.budget_level);
      }
      if (filters.pace) {
        query = query.eq('characteristics->>pace', filters.pace);
      }
      if (filters.best_for) {
        query = query.eq('characteristics->>social_style', filters.best_for);
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