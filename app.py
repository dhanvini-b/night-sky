from flask import Flask, request, jsonify, render_template, abort
from database import init_db, get_connection
import random
import string

app = Flask(__name__)

def generate_code(length=6):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


# ── Pages ──────────────────────────────────────────────

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/sky/<code>')
def sky(code):
    conn = get_connection()
    space = conn.execute(
        'SELECT * FROM spaces WHERE unique_code = ?', (code,)
    ).fetchone()
    conn.close()

    if space is None:
        abort(404)

    return render_template('sky.html', space_name=space['name'], space_code=code)


# ── API ────────────────────────────────────────────────

@app.route('/api/space', methods=['POST'])
def create_space():
    data = request.get_json()
    name = data.get('name', 'Untitled Sky').strip()

    code = generate_code()
    conn = get_connection()

    while conn.execute(
        'SELECT id FROM spaces WHERE unique_code = ?', (code,)
    ).fetchone():
        code = generate_code()

    conn.execute(
        'INSERT INTO spaces (unique_code, name) VALUES (?, ?)', (code, name)
    )
    conn.commit()
    conn.close()

    return jsonify({ 'code': code, 'url': f'/sky/{code}' })


@app.route('/api/space/<code>', methods=['GET'])
def get_stars(code):
    conn = get_connection()
    space = conn.execute(
        'SELECT * FROM spaces WHERE unique_code = ?', (code,)
    ).fetchone()

    if space is None:
        conn.close()
        return jsonify({ 'error': 'Space not found' }), 404

    stars = conn.execute(
        'SELECT * FROM stars WHERE space_id = ? ORDER BY created_at ASC',
        (space['id'],)
    ).fetchall()
    conn.close()

    return jsonify([dict(star) for star in stars])


@app.route('/api/space/<code>/star', methods=['POST'])
def add_star(code):
    data = request.get_json()

    message = data.get('message', '').strip()
    author  = data.get('author', 'anonymous').strip() or 'anonymous'
    x       = float(data.get('x_percent', 50))
    y       = float(data.get('y_percent', 50))

    if not message:
        return jsonify({ 'error': 'Message cannot be empty' }), 400

    if len(message) > 280:
        return jsonify({ 'error': 'Message too long (max 280 chars)' }), 400

    conn = get_connection()
    space = conn.execute(
        'SELECT * FROM spaces WHERE unique_code = ?', (code,)
    ).fetchone()

    if space is None:
        conn.close()
        return jsonify({ 'error': 'Space not found' }), 404

    cursor = conn.execute(
        'INSERT INTO stars (space_id, x_percent, y_percent, message, author) VALUES (?, ?, ?, ?, ?)',
        (space['id'], x, y, message, author)
    )
    conn.commit()
    star_id = cursor.lastrowid
    conn.close()

    return jsonify({
        'id': star_id,
        'x_percent': x,
        'y_percent': y,
        'message': message,
        'author': author
    }), 201

@app.route('/api/space/<code>/star/<int:star_id>', methods=['DELETE'])
def delete_star(code, star_id):
    conn = get_connection()
    space = conn.execute(
        'SELECT * FROM spaces WHERE unique_code = ?', (code,)
    ).fetchone()

    if space is None:
        conn.close()
        return jsonify({ 'error': 'Space not found' }), 404

    star = conn.execute(
        'SELECT * FROM stars WHERE id = ? AND space_id = ?', (star_id, space['id'])
    ).fetchone()

    if star is None:
        conn.close()
        return jsonify({ 'error': 'Star not found' }), 404

    conn.execute('DELETE FROM stars WHERE id = ?', (star_id,))
    conn.commit()
    conn.close()

    return jsonify({ 'success': True })


@app.errorhandler(404)
def not_found(e):
    return jsonify({ 'error': 'Not found' }), 404


# ── Run ────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    app.run(debug=True)